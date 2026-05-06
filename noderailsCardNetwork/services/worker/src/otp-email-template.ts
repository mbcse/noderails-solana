/**
 * WallCard OTP transactional email — table layout, inline styles (SES/Gmail safe).
 * Logo: prefer HTTPS URL via WALLCARD_OTP_EMAIL_LOGO_URL (e.g. CDN or marketing site path).
 */

export interface WallCardOtpEmailOptions {
  code: string;
  /** Queue job purpose (e.g. signing) — adjusts copy slightly */
  purpose?: string;
  expiresInMinutes?: number;
  /** Public HTTPS URL to WallCard mark image (PNG recommended for Outlook) */
  logoUrl?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline SVG mark — works in Apple Mail, many web clients; Gmail may omit (keep logoUrl for prod). */
const WALLCARD_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <defs><linearGradient id="wcw" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
    <stop offset="0%" stop-color="#c4b5fd"/><stop offset="55%" stop-color="#f472b6"/><stop offset="100%" stop-color="#fb923c"/>
  </linearGradient></defs>
  <path d="M4 6 L11 32 L20 14 L29 32 L36 6 L30 6 L25.5 22 L20 10 L14.5 22 L10 6 Z" fill="url(#wcw)"/>
</svg>`;

export function renderWallCardOtpEmailHtml(data: WallCardOtpEmailOptions): string {
  const code = escapeHtml(data.code);
  const mins = data.expiresInMinutes ?? 5;
  const purpose = data.purpose ?? "";
  const isSigning = purpose === "signing";
  const logoUrl = data.logoUrl?.trim();

  const lead = isSigning
    ? "Enter this code in WallCard to verify your email and continue with signing."
    : "Enter this code to verify your email for WallCard.";

  const disclaimer = isSigning
    ? "If you did not try to sign with WallCard, you can ignore this message."
    : "If you did not request this code, you can ignore this message.";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="44" height="44" alt="WallCard" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="line-height:0;">${WALLCARD_MARK_SVG}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta http-equiv="x-ua-compatible" content="ie=edge"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr>
          <td style="background-color:#1e1b4b;background-image:linear-gradient(135deg,#312e81 0%,#5b21b6 42%,#7c3aed 100%);padding:28px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">${logoBlock}</td>
                <td style="vertical-align:middle;text-align:left;">
                  <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">WallCard</div>
                  <div style="margin-top:6px;font-size:12px;color:rgba(226,232,240,0.88);line-height:1.4;">Card-authenticated signing<br/><span style="opacity:0.85;">by NodeRails</span></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.65;">${lead}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 24px;">
                <div style="display:inline-block;padding:22px 28px;background-color:#faf5ff;border:2px solid #c4b5fd;border-radius:14px;">
                  <span style="font-size:34px;font-weight:800;letter-spacing:0.35em;color:#4c1d95;font-family:'SF Mono','Segoe UI Mono','Roboto Mono','Courier New',monospace;">${code}</span>
                </div>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;color:#64748b;font-size:13px;text-align:center;line-height:1.5;">This code expires in <strong style="color:#475569;">${mins} minutes</strong>.</p>
            <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.55;">${disclaimer}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.5;">
              © ${new Date().getFullYear()} NodeRails · WallCard is built on NodeRails payment infrastructure.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderWallCardOtpEmailText(data: WallCardOtpEmailOptions): string {
  const mins = data.expiresInMinutes ?? 5;
  const purpose = data.purpose ?? "";
  const isSigning = purpose === "signing";
  const lead = isSigning
    ? "Enter this code in WallCard to verify your email and continue with signing."
    : "Enter this code to verify your email for WallCard.";
  const disclaimer = isSigning
    ? "If you did not try to sign with WallCard, you can ignore this message."
    : "If you did not request this code, you can ignore this message.";
  return [
    "WallCard · by NodeRails",
    "",
    lead,
    "",
    `Your code: ${data.code}`,
    "",
    `This code expires in ${mins} minutes.`,
    "",
    disclaimer,
    "",
    `© ${new Date().getFullYear()} NodeRails`
  ].join("\n");
}
