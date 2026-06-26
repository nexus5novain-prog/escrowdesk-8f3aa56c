// Single source of truth for the canonical public base URL.
//
// Override via the VITE_APP_URL env var (works in both the client and server
// bundles because of the VITE_ prefix). Update once in `.env` to change the
// domain — every Telegram CTA, web link, and redirect uses this value.

const FALLBACK = "https://escrowdesk.nexorian.shop";

export const APP_URL: string =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/+$/, "") ||
  FALLBACK;

/** Canonical hostname (no protocol, no trailing slash). */
export const APP_HOST: string = new URL(APP_URL).host;

/** Legacy hostnames that should 301 to APP_HOST. */
export const LEGACY_HOSTS: readonly string[] = ["escrowdesk.lovable.app"];
