// Provider abstraction for IIN/BIN → issuer metadata lookups.
// Server-only. The frontend never calls providers directly — it talks to
// the /api/payment-metadata endpoint, which selects the active provider
// and applies caching + audit.

export type PaymentMetadata = {
  bin: string;
  network: string | null;       // VISA, MASTERCARD, AMEX…
  brand: string | null;         // Issuer brand (e.g. Classic, Platinum)
  type: string | null;          // DEBIT / CREDIT / PREPAID
  bank: string | null;          // Issuer bank
  country: string | null;       // ISO country name (UNITED STATES)
  country_code: string | null;  // ISO alpha-2 (US)
  source: string;               // Provider id
};

export interface PaymentMetadataProvider {
  id: string;
  lookup(bin: string): Promise<PaymentMetadata | null>;
}

// ---------- Local provider (bin_metadata table) ----------
const localProvider: PaymentMetadataProvider = {
  id: "local-bin-metadata",
  async lookup(bin) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bin_metadata")
      .select("bin_number, card_brand, card_type, card_bank, card_country")
      .eq("bin_number", bin)
      .maybeSingle();
    if (error || !data) return null;
    // We don't store ISO alpha-2 separately yet — derive a best-effort code.
    const cc = COUNTRY_TO_CODE[(data.card_country ?? "").toUpperCase()] ?? null;
    // Heuristic: brand line often encodes "VISA / CLASSIC"; first token is network.
    const brandStr = (data.card_brand ?? "").trim();
    const network = brandStr.split(/[\s/-]/)[0]?.toUpperCase() || null;
    return {
      bin: data.bin_number,
      network,
      brand: brandStr || null,
      type: data.card_type ?? null,
      bank: data.card_bank ?? null,
      country: data.card_country ?? null,
      country_code: cc,
      source: this.id,
    };
  },
};

// ---------- Provider selection ----------
// Add new providers (e.g. external BIN API) and switch via env without
// touching the frontend.
const PROVIDERS: PaymentMetadataProvider[] = [localProvider];

export function getActiveProviders(): PaymentMetadataProvider[] {
  const id = process.env.PAYMENT_METADATA_PROVIDER;
  if (!id) return PROVIDERS;
  const picked = PROVIDERS.filter((p) => p.id === id);
  return picked.length ? picked : PROVIDERS;
}

// ---------- In-memory cache (per Worker isolate) ----------
type CacheEntry = { value: PaymentMetadata | null; expires: number };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_MAX = 5000;

export function cacheGet(bin: string): CacheEntry | undefined {
  const e = CACHE.get(bin);
  if (!e) return undefined;
  if (e.expires < Date.now()) { CACHE.delete(bin); return undefined; }
  return e;
}
export function cacheSet(bin: string, value: PaymentMetadata | null) {
  if (CACHE.size >= CACHE_MAX) {
    // simple LRU-ish: drop oldest 10%
    const drop = Math.ceil(CACHE_MAX / 10);
    let i = 0;
    for (const k of CACHE.keys()) { CACHE.delete(k); if (++i >= drop) break; }
  }
  CACHE.set(bin, { value, expires: Date.now() + CACHE_TTL_MS });
}

// ---------- Provider failover ----------
export async function lookupWithFailover(bin: string): Promise<PaymentMetadata | null> {
  const cached = cacheGet(bin);
  if (cached) return cached.value;
  for (const p of getActiveProviders()) {
    try {
      const r = await p.lookup(bin);
      if (r) { cacheSet(bin, r); return r; }
    } catch (err) {
      console.error(`[payment-metadata] provider ${p.id} failed:`, err);
    }
  }
  cacheSet(bin, null);
  return null;
}

// ---------- Tiny in-memory token bucket (per IP) ----------
// Best-effort only — Worker isolates are stateless across requests so this
// limits bursts per warm isolate, not globally. Acceptable for an info-only
// endpoint that hits a local table; a global limiter needs Durable Objects.
type Bucket = { tokens: number; updated: number };
const BUCKETS = new Map<string, Bucket>();
const RATE_PER_MIN = 60;
const RATE_REFILL_MS = 60 * 1000 / RATE_PER_MIN;
const RATE_MAX = 60;

export function consumeToken(ip: string): boolean {
  const now = Date.now();
  let b = BUCKETS.get(ip);
  if (!b) { b = { tokens: RATE_MAX, updated: now }; BUCKETS.set(ip, b); }
  const refill = Math.floor((now - b.updated) / RATE_REFILL_MS);
  if (refill > 0) {
    b.tokens = Math.min(RATE_MAX, b.tokens + refill);
    b.updated = now;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}

// ---------- Country name → ISO alpha-2 (most-common entries) ----------
const COUNTRY_TO_CODE: Record<string, string> = {
  "UNITED STATES": "US", "CANADA": "CA", "UNITED KINGDOM": "GB",
  "AUSTRALIA": "AU", "NEW ZEALAND": "NZ", "GERMANY": "DE", "FRANCE": "FR",
  "ITALY": "IT", "SPAIN": "ES", "PORTUGAL": "PT", "NETHERLANDS": "NL",
  "BELGIUM": "BE", "SWITZERLAND": "CH", "AUSTRIA": "AT", "IRELAND": "IE",
  "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK", "FINLAND": "FI",
  "POLAND": "PL", "CZECH REPUBLIC": "CZ", "GREECE": "GR", "HUNGARY": "HU",
  "ROMANIA": "RO", "BULGARIA": "BG", "TURKEY": "TR", "RUSSIA": "RU",
  "UKRAINE": "UA", "INDIA": "IN", "CHINA": "CN", "JAPAN": "JP",
  "SOUTH KOREA": "KR", "SINGAPORE": "SG", "MALAYSIA": "MY",
  "INDONESIA": "ID", "THAILAND": "TH", "VIETNAM": "VN", "PHILIPPINES": "PH",
  "BRAZIL": "BR", "ARGENTINA": "AR", "CHILE": "CL", "MEXICO": "MX",
  "COLOMBIA": "CO", "PERU": "PE", "SOUTH AFRICA": "ZA", "NIGERIA": "NG",
  "EGYPT": "EG", "KENYA": "KE", "GHANA": "GH", "MOROCCO": "MA",
  "UNITED ARAB EMIRATES": "AE", "SAUDI ARABIA": "SA", "ISRAEL": "IL",
  "QATAR": "QA", "KUWAIT": "KW", "BAHRAIN": "BH", "OMAN": "OM",
  "JORDAN": "JO", "LEBANON": "LB", "PAKISTAN": "PK", "BANGLADESH": "BD",
};
