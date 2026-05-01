import type { WallCardRpcIntent } from "./types.js";

export type { WallCardRpcIntent } from "./types.js";
export { buildWallCardSigningPayload, normalizeWalletRpcParams } from "./signing-payload.js";

type ProviderRequest = { method: string; params?: unknown[] | Record<string, unknown> };

function resolveWalletOrigin(url: string | undefined, production: boolean): string {
  const t = url?.trim() ?? "";
  if (t.length > 0) return t.replace(/\/$/, "");
  return production ? "https://webapp.wallcard.noderails.com" : "http://localhost:8090";
}

function resolveApiBaseUrl(url: string | undefined, production: boolean): string {
  const t = url?.trim() ?? "";
  if (t.length > 0) return t.replace(/\/$/, "");
  return production ? "https://api.noderailscard.network" : "http://localhost:9080";
}

export type CreateProviderOptions = {
  environment: "development" | "production";
  walletOrigin?: string;
  /** Defaults from environment: dev → localhost:9080 */
  apiBaseUrl?: string;
  mode?: "iframe" | "popup" | "auto";
};

export type NoderailsCardProvider = {
  request: (payload: ProviderRequest) => Promise<unknown>;
  setAccessToken: (token: string | null) => void;
  getAccessToken: () => string | null;
  /** Refetch `/v1/wallet/accounts` (needs Bearer token). */
  refreshWalletAccounts: () => Promise<void>;
  /** Current cached addresses after `refreshWalletAccounts` / `eth_requestAccounts`. */
  getLinkedAddresses: () => { evm: string; sol: string };
  on: () => undefined;
  removeListener: () => undefined;
  isNoderailsCard: true;
};

export function createNoderailsCardProvider(options: CreateProviderOptions): NoderailsCardProvider {
  const production = options.environment === "production";
  const walletOrigin = resolveWalletOrigin(options.walletOrigin, production);
  const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl, production);
  const mode = options.mode ?? "auto";

  let selectedChain = "0x1";
  let selectedAccount = "0x0000000000000000000000000000000000000000";
  let solanaAccount = "";
  let accessToken: string | null = null;

  async function refreshWalletAccounts(): Promise<void> {
    if (!accessToken) return;
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/wallet/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    });
    if (!res.ok) return;
    const body = (await res.json()) as { data?: { chainFamily: string; address: string }[] };
    const rows = body.data ?? [];
    const evm = rows.find((a) => a.chainFamily === "evm")?.address;
    const sol = rows.find((a) => a.chainFamily === "solana")?.address;
    if (evm) selectedAccount = evm;
    if (sol) solanaAccount = sol;
  }

  async function request(payload: ProviderRequest): Promise<unknown> {
    if (payload.method === "eth_requestAccounts") {
      await refreshWalletAccounts();
      return [selectedAccount];
    }
    if (payload.method === "eth_accounts") {
      await refreshWalletAccounts();
      return [selectedAccount];
    }
    if (payload.method === "eth_chainId") {
      return selectedChain;
    }
    if (payload.method === "wallet_switchEthereumChain") {
      const params = Array.isArray(payload.params) ? payload.params[0] : undefined;
      const chainId = (params as { chainId?: string } | undefined)?.chainId;
      if (chainId) selectedChain = chainId;
      return null;
    }
    if (payload.method === "wallet_addEthereumChain") {
      return null;
    }

    if (
      payload.method === "eth_sendTransaction" ||
      payload.method === "eth_signTransaction" ||
      payload.method === "eth_sign" ||
      payload.method === "personal_sign" ||
      payload.method === "eth_signTypedData_v4" ||
      payload.method === "solana_signMessage" ||
      payload.method === "solana_signTransaction"
    ) {
      await refreshWalletAccounts();
      const intent = {
        method: payload.method,
        params: payload.params,
        chainIdHex: selectedChain,
        evmAddress: selectedAccount,
        solAddress: solanaAccount
      };
      return await openWalletUI(walletOrigin, intent, mode, accessToken);
    }

    throw new Error(`Unsupported method: ${payload.method}`);
  }

  return {
    request,
    setAccessToken(token: string | null) {
      accessToken = token;
      void refreshWalletAccounts();
    },
    getAccessToken: () => accessToken,
    refreshWalletAccounts,
    getLinkedAddresses: () => ({ evm: selectedAccount, sol: solanaAccount }),
    on: () => undefined,
    removeListener: () => undefined,
    isNoderailsCard: true
  };
}

export type OpenWallCardLoginOptions = {
  walletOrigin?: string;
  environment?: "development" | "production";
  timeoutMs?: number;
  popupFeatures?: string;
};

/**
 * Opens the wallet `/auth` flow in a popup; returning tab receives `accessToken` via postMessage.
 */
export function openWallCardLogin(options: OpenWallCardLoginOptions = {}): Promise<string> {
  const production = (options.environment ?? "development") === "production";
  const walletOrigin = resolveWalletOrigin(options.walletOrigin, production);
  const origin = new URL(walletOrigin).origin;
  const parentOrigin = window.location.origin;
  const url = `${walletOrigin.replace(/\/$/, "")}/auth?return_origin=${encodeURIComponent(parentOrigin)}`;

  return new Promise((resolve, reject) => {
    const popup = window.open(
      url,
      "noderails-card-login",
      options.popupFeatures ?? "width=480,height=720"
    );
    if (!popup) {
      reject(new Error("login_popup_blocked"));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("login_timeout"));
    }, options.timeoutMs ?? 180_000);

    const poll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("login_window_closed"));
      }
    }, 400);

    function cleanup() {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("message", onMessage);
    }

    function onMessage(ev: MessageEvent) {
      if (ev.origin !== origin) return;
      if (ev.data?.type !== "noderails-card:session") return;
      const token = ev.data.accessToken;
      if (typeof token !== "string" || token.length < 10) return;
      cleanup();
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      resolve(token);
    }

    window.addEventListener("message", onMessage);
  });
}

function openWalletUI(
  walletOrigin: string,
  intent: WallCardRpcIntent,
  mode: "iframe" | "popup" | "auto",
  bearerToken: string | null
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const origin = new URL(walletOrigin).origin;
    const requestId = crypto.randomUUID();
    const chainHint = intent.method.startsWith("solana_") ? "solana" : "evm";
    const parentOrigin = encodeURIComponent(window.location.origin);
    const baseUrl = `${walletOrigin.replace(/\/$/, "")}/sign?rid=${encodeURIComponent(requestId)}&chain=${chainHint}&method=${encodeURIComponent(intent.method)}&parentOrigin=${parentOrigin}`;
    const shouldUseIframe = mode === "iframe" || mode === "auto";

    const cleanupFns: Array<() => void> = [];

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      if (event.data?.requestId !== requestId) return;
      if (event.data?.type === "noderails-card:success") {
        cleanupFns.forEach((fn) => fn());
        window.removeEventListener("message", onMessage);
        resolve(event.data.payload?.result ?? event.data.payload?.signature ?? event.data.payload);
      }
      if (event.data?.type === "noderails-card:error") {
        cleanupFns.forEach((fn) => fn());
        window.removeEventListener("message", onMessage);
        reject(new Error(String(event.data?.payload?.error ?? "wallet_error")));
      }
      if (event.data?.type === "noderails-card:cancel") {
        cleanupFns.forEach((fn) => fn());
        window.removeEventListener("message", onMessage);
        reject(new Error("user_rejected"));
      }
    };
    window.addEventListener("message", onMessage);
    cleanupFns.push(() => window.removeEventListener("message", onMessage));

    function sendIntent(target: Window | null) {
      if (!target) return;
      target.postMessage(
        { type: "noderails-card:intent", requestId, intent },
        origin
      );
    }

    /** Sync JWT held only in the parent provider into the wallet iframe/popup (wallet origin localStorage may be empty). */
    function sendBearer(target: Window | null) {
      if (!target || !bearerToken || bearerToken.length < 10) return;
      target.postMessage({ type: "noderails-card:bearer", requestId, accessToken: bearerToken }, origin);
    }

    function attachReadyWait(targetWindow: Window | null, isPopup: boolean) {
      const readyTimeout = window.setTimeout(() => {
        cleanupFns.forEach((fn) => fn());
        reject(new Error("wallet_ready_timeout"));
      }, 90_000);
      cleanupFns.push(() => window.clearTimeout(readyTimeout));

      const onReady = (event: MessageEvent) => {
        if (event.origin !== origin) return;
        if (event.data?.type !== "noderails-card:ready") return;
        if (event.data?.requestId !== requestId) return;
        window.removeEventListener("message", onReady);
        window.clearTimeout(readyTimeout);
        sendBearer(targetWindow);
        sendIntent(targetWindow);
      };
      window.addEventListener("message", onReady);
      cleanupFns.push(() => {
        window.removeEventListener("message", onReady);
        window.clearTimeout(readyTimeout);
      });

      if (isPopup && targetWindow) {
        const poll = window.setInterval(() => {
          if ((targetWindow as Window).closed) {
            window.clearInterval(poll);
            cleanupFns.forEach((fn) => fn());
            reject(new Error("wallet_closed"));
          }
        }, 400);
        cleanupFns.push(() => window.clearInterval(poll));
      }
    }

    if (shouldUseIframe) {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2147483647";
      overlay.style.boxSizing = "border-box";
      overlay.style.padding = "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))";
      overlay.style.background = "rgba(10, 10, 18, 0.62)";
      overlay.style.backdropFilter = "blur(14px)";
      (overlay.style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter = "blur(14px)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";

      const shell = document.createElement("div");
      shell.style.boxSizing = "border-box";
      shell.style.width = "min(432px, calc(100vw - 32px))";
      shell.style.maxHeight = "min(860px, calc(100vh - 32px))";
      shell.style.borderRadius = "20px";
      shell.style.overflow = "hidden";
      shell.style.background = "#ffffff";
      shell.style.boxShadow =
        "0 0 0 1px rgba(255,255,255,0.12), 0 32px 96px rgba(0,0,0,0.45), 0 12px 40px rgba(15,23,42,0.18)";

      const iframe = document.createElement("iframe");
      iframe.src = `${baseUrl}&mode=iframe`;
      iframe.title = "WallCard";
      iframe.style.display = "block";
      iframe.style.border = "0";
      iframe.style.width = "100%";
      iframe.style.height = "min(840px, calc(100vh - 48px))";
      iframe.style.borderRadius = "0";
      iframe.setAttribute("allow", "clipboard-read; clipboard-write");

      shell.appendChild(iframe);
      overlay.appendChild(shell);
      document.body.appendChild(overlay);
      cleanupFns.push(() => overlay.remove());

      const onIframeLoad = () => {
        attachReadyWait(iframe.contentWindow, false);
      };
      iframe.addEventListener("load", onIframeLoad);
      cleanupFns.push(() => iframe.removeEventListener("load", onIframeLoad));
      return;
    }

    const popup = window.open(`${baseUrl}&mode=popup`, "noderails-card-wallet", "width=480,height=780");
    if (!popup) {
      cleanupFns.forEach((fn) => fn());
      reject(new Error("wallet_popup_blocked"));
      return;
    }
    attachReadyWait(popup, true);
  });
}

export function announceEip6963Wallet(): void {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: {
        info: {
          uuid: crypto.randomUUID(),
          name: "Noderails Card",
          icon: "",
          rdns: "network.noderails.card"
        }
      }
    })
  );
}
