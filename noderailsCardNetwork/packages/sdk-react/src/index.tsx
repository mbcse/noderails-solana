import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createNoderailsCardProvider } from "@noderails-card/sdk-core";

const ProviderContext = createContext<ReturnType<typeof createNoderailsCardProvider> | null>(null);

export function NoderailsCardProvider({
  children,
  environment = "development"
}: {
  children: ReactNode;
  environment?: "development" | "production";
}) {
  const provider = useMemo(() => createNoderailsCardProvider({ environment }), [environment]);
  return <ProviderContext.Provider value={provider}>{children}</ProviderContext.Provider>;
}

export function useNoderailsCardWallet() {
  const provider = useContext(ProviderContext);
  if (!provider) throw new Error("NoderailsCardProvider missing");
  return provider;
}

export function ConnectButton() {
  const wallet = useNoderailsCardWallet();
  return (
    <button
      onClick={async () => {
        await wallet.request({ method: "eth_requestAccounts" });
      }}
    >
      Connect Noderails Card
    </button>
  );
}
