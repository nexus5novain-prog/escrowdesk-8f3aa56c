import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ASSETS = ["BTC"] as const;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

/* ─────────────────────── Public masking helpers ─────────────────────── */
// Mask cardholder: show first name + asterisks for every remaining name char.
// e.g. "John Michael Smith" -> "John ******* *****"
function maskHolder(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    // single name -> reveal first 2 chars
    const first = parts[0];
    if (first.length <= 2) return first;
    return first[0] + "•".repeat(Math.max(3, first.length - 1));
  }
  const [first, ...rest] = parts;
  const masked = rest.map((p) => "•".repeat(Math.max(3, p.length))).join(" ");
  return `${first} ${masked}`;
}

// Reveal only the real 6-digit BIN, mask the rest. Never leak last 4 publicly.
function publicCardNumber(cardNumber?: string | null, bin?: string | null): string | null {
  const digits = (cardNumber ?? "").replace(/\D/g, "");
  const realBin = (bin ?? digits.slice(0, 6)).replace(/\D/g, "").slice(0, 6);
  if (realBin.length < 6) return null;
  // 16-digit synthetic representation: real BIN + masked tail (display layer adds spacing)
  return `${realBin}XXXXXXXXXX`;
}

// Apply masking to a product row — preserves the row's shape, only overrides
// sensitive fields. Card PAN/CVV/expiry/billing address are no longer stored
// on marketplace_products at all (dropped at the schema level for security).
// We still mask the cardholder name and synthesize a BIN-only display value.
function maskProductRow<T extends { bin_number?: string | null; card_user?: string | null }>(row: T): T {
  const bin = (row.bin_number ?? "").replace(/\D/g, "").slice(0, 6) || null;
  const out: Record<string, unknown> = { ...row };
  out.bin_number = bin;
  out.card_number = publicCardNumber(null, bin);
  out.card_user = maskHolder(row.card_user ?? null);
  return out as T;
}





/* ─────────────────────── Public reads ─────────────────────── */
export const listProducts = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ q: z.string().max(120).optional(), category: z.string().max(60).optional() })
      .optional()
      .transform((v) => v ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("marketplace_products")
      .select("id,name,description,category,price,currency,image_url,stock,status,is_featured,created_at,seller_wallet_asset,card_number,bin_number,card_type,card_brand,card_bank,card_user,card_country,expire_date,card_style")
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.q) {
      const needle = `%${data.q}%`;
      q = q.or(
        `name.ilike.${needle},description.ilike.${needle},bin_number.ilike.${needle},card_bank.ilike.${needle},card_type.ilike.${needle}`,
      );
    }
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const products = (rows ?? []).map((r) => maskProductRow(r));
    return { products };
  });

// Builds a rich, ready-to-paste product description from BIN metadata.
// Used both by the lookup endpoint (admin form auto-fill) and by the seeder
// so seeded listings carry the same detail level as manually-entered ones.
function buildBinDescription(m: {
  bin_number: string;
  card_brand?: string | null;
  card_type?: string | null;
  card_bank?: string | null;
  card_country?: string | null;
  card_level?: string | null;
  currency?: string | null;
}): string {
  const network = (m.card_brand || "Card").toString().toUpperCase();
  const type = (m.card_type || "").toString().toLowerCase();
  const headline = `${network}${type ? " " + type : ""} card — BIN ${m.bin_number}`;
  const lines = [`💳 ${headline}`];
  if (m.card_bank) lines.push(`🏦 Issuer: ${m.card_bank}`);
  if (m.card_country) lines.push(`🌍 Country: ${m.card_country}`);
  if (m.card_level) lines.push(`⭐ Level: ${m.card_level}`);
  if (m.currency) lines.push(`💱 Currency: ${m.currency}`);
  lines.push(`🔢 BIN range: ${m.bin_number}xxxxxxxxxx`);
  lines.push("");
  lines.push("Full PAN, CVV, expiry and billing address are released in the");
  lines.push("escrow trade room only after the buyer funds the deposit.");
  return lines.join("\n");
}

// BIN lookup accepts either a full card_number OR a 4–8 digit BIN prefix and
// returns enriched metadata plus a pre-built description for auto-fill. It
// reads from bin_metadata first, then falls back to the richer `bins` table
// when fields are missing (card_level, currency, country_code).
export const lookupBinMetadata = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    card_number: z.string().trim().min(4).max(32).optional(),
    bin: z.string().trim().min(4).max(8).optional(),
  }).refine((v) => v.card_number || v.bin, { message: "card_number or bin required" }))
  .handler(async ({ data }) => {
    const raw = (data.bin ?? data.card_number ?? "").replace(/\D/g, "");
    const bin = raw.slice(0, 6);
    if (bin.length < 6) return { metadata: null };

    const { data: meta } = await supabaseAdmin
      .from("bin_metadata")
      .select("bin_number,card_brand,card_type,card_bank,card_country,card_address,description")
      .eq("bin_number", bin)
      .maybeSingle();

    // Fallback / enrichment from raw `bins` import table
    const { data: raw2 } = await supabaseAdmin
      .from("bins")
      .select("bin,bank,brand,card_type,card_level,country,country_code,currency,notes")
      .eq("bin", bin)
      .maybeSingle();

    if (!meta && !raw2) return { metadata: null };

    const merged = {
      bin_number: bin,
      card_brand: meta?.card_brand ?? raw2?.brand ?? null,
      card_type: meta?.card_type ?? raw2?.card_type ?? null,
      card_bank: meta?.card_bank ?? raw2?.bank ?? null,
      card_country: meta?.card_country ?? raw2?.country ?? null,
      card_country_code: raw2?.country_code ?? null,
      card_level: raw2?.card_level ?? null,
      currency: raw2?.currency ?? null,
      card_address: meta?.card_address ?? null,
      description: meta?.description ?? null,
    };

    const auto_description = buildBinDescription(merged);
    const suggested_name = `${merged.card_bank ?? "Issuer"} ${merged.card_brand ?? "Card"} ${merged.card_type ?? ""} — BIN ${bin}`.replace(/\s+/g, " ").trim();

    return { metadata: { ...merged, auto_description, suggested_name } };
  });

export { buildBinDescription };

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id,name,description,category,price,currency,image_url,stock,status,is_featured,created_at,seller_wallet_asset,seller_wallet_address,card_number,bin_number,card_user,card_type,card_brand,card_bank,card_country,card_address,expire_date,card_style")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found");
    // Sensitive details (full PAN, CVV, billing address) are only revealed inside the
    // escrow group after a buyer completes the purchase — see buyProduct.
    return { product: maskProductRow(row) };
  });

/* ─────────────────────── Seed pools (realistic demo data) ─────────────────────── */
const FIRST_NAMES = [
  "James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Elizabeth",
  "David","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
  "Daniel","Nancy","Matthew","Lisa","Anthony","Margaret","Mark","Betty","Donald","Sandra",
  "Steven","Ashley","Paul","Emily","Andrew","Kimberly","Joshua","Donna","Kevin","Michelle",
  "Brian","Carol","George","Amanda","Edward","Melissa","Ronald","Deborah","Timothy","Stephanie",
];
const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomName(): string { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomExpire(): string {
  const month = String(randInt(1, 12)).padStart(2, "0");
  const year = String(randInt(26, 30)).padStart(2, "0");
  return `${month}/${year}`;
}

function randomCVV(brand: string): string {
  const len = /amex|express/i.test(brand) ? 4 : 3;
  let s = "";
  for (let i = 0; i < len; i++) s += String(randInt(0, 9));
  return s;
}

function randomCardNumber(bin: string, brand: string): string {
  const totalLen = /amex|express/i.test(brand) ? 15 : 16;
  let s = bin;
  while (s.length < totalLen) s += String(randInt(0, 9));
  return s.slice(0, totalLen);
}

// Realistic-looking listing titles per category
const NAME_TEMPLATES: Record<string, string[]> = {
  ENROLL: [
    "{bank} Online Banking Enroll Guide",
    "{bank} Bill Pay Enroll Kit",
    "Fresh {bank} Enrollment Pack",
    "{bank} New Account Walkthrough",
  ],
  SCANNER: [
    "FullZ Scanner Pro v{v}",
    "Bank Statement OCR Scanner v{v}",
    "ID Doc Validator v{v}",
    "Routing/Account Scanner v{v}",
  ],
  COMBO: [
    "USA Fresh Combo {n}x",
    "EU Mail:Pass Combo {n}k",
    "Crypto Exchange Combo {n}x",
    "Banking Logins Combo {n}x",
  ],
  OTHERS: [
    "RDP Tier-1 (US East)",
    "SOCKS5 Residential Proxies Pack",
    "Stealth VPN — 30 day",
    "Disposable Email Pack",
    "Verified SMS Numbers Pack",
  ],
};
const BANK_POOL = ["Chase","Wells Fargo","Bank of America","Citi","Capital One","HSBC","Barclays","TD","BMO","Santander"];

function templateName(cat: keyof typeof NAME_TEMPLATES): string {
  const t = pick(NAME_TEMPLATES[cat]);
  return t
    .replace("{bank}", pick(BANK_POOL))
    .replace("{v}", String(randInt(2, 9)))
    .replace("{n}", String(randInt(1, 9)));
}

const STREETS = ["Main St","Oak Ave","Maple Dr","Pine Rd","Elm St","Cedar Ln","Park Ave","Washington St","Lake Dr","Sunset Blvd"];
const CITIES_BY_CC: Record<string, string[]> = {
  US: ["New York, NY","Los Angeles, CA","Chicago, IL","Houston, TX","Phoenix, AZ","Philadelphia, PA","Miami, FL","Seattle, WA"],
  GB: ["London","Manchester","Birmingham","Leeds","Glasgow","Bristol"],
  CA: ["Toronto, ON","Vancouver, BC","Montreal, QC","Calgary, AB"],
  DE: ["Berlin","Munich","Hamburg","Frankfurt"],
  FR: ["Paris","Lyon","Marseille","Toulouse"],
  IE: ["Dublin","Cork","Galway"],
  AU: ["Sydney NSW","Melbourne VIC","Brisbane QLD"],
  BR: ["São Paulo","Rio de Janeiro","Brasília"],
  MX: ["Mexico City","Guadalajara","Monterrey"],
};
function randomBillingAddress(cc: string): string {
  const code = (cc || "US").toUpperCase().slice(0, 2);
  const cities = CITIES_BY_CC[code] ?? CITIES_BY_CC.US;
  const num = randInt(10, 9999);
  return `${num} ${pick(STREETS)}, ${pick(cities)}, ${code}`;
}

const CATEGORY_BLURBS: Record<string, string[]> = {
  ENROLL: [
    "Step-by-step online banking enrollment guide. Includes screenshots and OTP handling tips.",
    "Fresh enrollment pack with paired email + phone. Verified working within the last 24h.",
    "Complete bill-pay setup walkthrough — works on web and mobile app.",
  ],
  SCANNER: [
    "High-accuracy OCR scanner tuned for US bank statements and tax forms.",
    "Detects routing/account numbers, ID fields, and selfie matches with confidence scores.",
    "Validator suite — runs MOD-10, BIN, and issuer cross-checks in under 200ms.",
  ],
  COMBO: [
    "Fresh combo list, deduplicated and validated. Hit rate ≥ 18% on first 1k checks.",
    "Region-targeted credentials, formatted as user:pass per line.",
    "Curated combo focused on banking + crypto exchange logins.",
  ],
  OTHERS: [
    "Premium service access — instant delivery after escrow funding.",
    "Verified working stock, replaced free of charge if dead on arrival.",
    "Includes setup notes and a 24h support window via the trade room.",
  ],
};
function buildCategoryDescription(cat: string, name: string): string {
  const pool = CATEGORY_BLURBS[cat] ?? CATEGORY_BLURBS.OTHERS;
  const blurb = pick(pool);
  return [
    `📦 ${name}`,
    "",
    blurb,
    "",
    "Delivered through the escrow trade room after the buyer funds the deposit.",
  ].join("\n");
}

/* ─────────────────────── Seeder ─────────────────────── */
export const adminSeedSampleProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      perCategory: z.number().int().min(1).max(50).default(10),
      category: z.enum(["BIN/CC", "ENROLL", "SCANNER", "COMBO", "OTHERS"]).optional(),
    }).optional().transform((v) => v ?? { perCategory: 10 }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const cats = (data.category ? [data.category] : ["BIN/CC", "ENROLL", "SCANNER", "COMBO", "OTHERS"]) as Array<"BIN/CC"|"ENROLL"|"SCANNER"|"COMBO"|"OTHERS">;

    // Preload BIN data from BOTH catalogs and merge by BIN — gives the seeder
    // access to card_level / currency / country_code from the richer `bins` table.
    const [{ data: metaRows }, { data: rawRows }] = await Promise.all([
      supabaseAdmin.from("bin_metadata").select("bin_number,card_brand,card_type,card_bank,card_country"),
      supabaseAdmin.from("bins").select("bin,bank,brand,card_type,card_level,country,country_code,currency"),
    ]);
    const byBin = new Map<string, {
      bin_number: string; card_brand: string | null; card_type: string | null;
      card_bank: string | null; card_country: string | null;
      card_level: string | null; currency: string | null; country_code: string | null;
    }>();
    for (const m of metaRows ?? []) {
      byBin.set(m.bin_number, {
        bin_number: m.bin_number,
        card_brand: m.card_brand, card_type: m.card_type, card_bank: m.card_bank, card_country: m.card_country,
        card_level: null, currency: null, country_code: null,
      });
    }
    for (const r of rawRows ?? []) {
      const prev = byBin.get(r.bin);
      byBin.set(r.bin, {
        bin_number: r.bin,
        card_brand: prev?.card_brand ?? r.brand,
        card_type: prev?.card_type ?? r.card_type,
        card_bank: prev?.card_bank ?? r.bank,
        card_country: prev?.card_country ?? r.country,
        card_level: r.card_level,
        currency: r.currency,
        country_code: r.country_code,
      });
    }
    const bins = Array.from(byBin.values());

    const rows: Array<Record<string, unknown>> = [];
    for (const cat of cats) {
      for (let i = 1; i <= data.perCategory; i++) {
        const price = Math.round((10 + Math.random() * 290) * 100) / 100;
        const base: Record<string, unknown> = {
          category: cat,
          price,
          currency: "USD",
          image_url: null,
          stock: -1,
          seller_wallet_asset: "BTC",
          is_featured: i === 1,
          status: "active",
          is_seeded: true,
          created_by: context.userId,
        };
        if (cat === "BIN/CC") {
          const bin = bins.length ? pick(bins) : {
            bin_number: "414720", card_brand: "Visa", card_type: "Credit",
            card_bank: "Global Bank", card_country: "US",
            card_level: null, currency: "USD", country_code: "US",
          };
          const brand = bin.card_brand ?? "Visa";
          const binNum = bin.bin_number;
          const cardNumber = randomCardNumber(binNum, brand);
          const holder = randomName();
          const level = bin.card_level ? ` ${bin.card_level}` : "";
          base.name = `${bin.card_bank ?? "Bank"} ${brand}${level} ${bin.card_type ?? "Credit"} — BIN ${binNum}`;
          base.description = buildBinDescription(bin);
          base.card_number = cardNumber;
          base.bin_number = binNum;
          base.card_user = holder;
          base.card_type = bin.card_type ?? "Credit";
          base.card_brand = brand;
          base.card_bank = bin.card_bank ?? "Global Bank";
          base.card_country = bin.card_country ?? "US";
          base.card_address = randomBillingAddress(bin.country_code ?? bin.card_country ?? "US");
          base.cvv = randomCVV(brand);
          base.expire_date = randomExpire();
          if (bin.currency) base.currency = bin.currency;
        } else {
          const name = templateName(cat);
          base.name = name;
          base.description = buildCategoryDescription(cat, name);
        }
        rows.push(base);
      }
    }
    const { error } = await supabaseAdmin.from("marketplace_products").insert(rows as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

/* ─────────────────────── Admin CRUD ─────────────────────── */
export const adminListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("marketplace_products").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { products: data ?? [] };
  });

export const adminCreateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(5).max(4000),
    category: z.string().trim().min(2).max(60),
    price: z.number().positive(),
    currency: z.string().trim().min(3).max(8).default("USD"),
    image_url: z.string().trim().max(1000).optional().nullable(),
    stock: z.number().int().default(-1),
    seller_wallet_address: z.string().trim().max(200).optional().nullable(),
    seller_wallet_asset: z.enum(ASSETS).default("BTC"),
    is_featured: z.boolean().default(false),
    card_number: z.string().trim().min(12).max(32).optional().nullable(),
    bin_number: z.string().trim().min(6).max(6).optional().nullable(),
    card_user: z.string().trim().max(120).optional().nullable(),
    card_type: z.string().trim().max(120).optional().nullable(),
    card_brand: z.string().trim().max(120).optional().nullable(),
    card_bank: z.string().trim().max(120).optional().nullable(),
    card_country: z.string().trim().max(120).optional().nullable(),
    card_address: z.string().trim().max(300).optional().nullable(),
    cvv: z.string().trim().min(3).max(4).optional().nullable(),
    expire_date: z.string().trim().min(5).max(5).optional().nullable(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin.from("marketplace_products").insert({
      ...data,
      image_url: data.image_url || null,
      seller_wallet_address: data.seller_wallet_address || null,
      created_by: context.userId,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().min(5).max(4000).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    price: z.number().positive().optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    image_url: z.string().trim().max(1000).nullable().optional(),
    stock: z.number().int().optional(),
    seller_wallet_address: z.string().trim().max(200).nullable().optional(),
    seller_wallet_asset: z.enum(ASSETS).optional(),
    is_featured: z.boolean().optional(),
    status: z.enum(["active", "inactive", "sold_out"]).optional(),
    card_number: z.string().trim().min(12).max(32).nullable().optional(),
    bin_number: z.string().trim().min(6).max(6).nullable().optional(),
    card_user: z.string().trim().max(120).nullable().optional(),
    card_type: z.string().trim().max(120).nullable().optional(),
    card_brand: z.string().trim().max(120).nullable().optional(),
    card_bank: z.string().trim().max(120).nullable().optional(),
    card_country: z.string().trim().max(120).nullable().optional(),
    card_address: z.string().trim().max(300).nullable().optional(),
    cvv: z.string().trim().min(3).max(4).nullable().optional(),
    expire_date: z.string().trim().min(5).max(5).nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("marketplace_products").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("marketplace_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

// Admin-only product image upload. Accepts base64 data (≤ 5 MB) and writes to
// the private `product-images` bucket via the service role. Returns a long-lived
// signed URL suitable for storing in marketplace_products.image_url.
export const adminUploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    content_type: z.string().trim().min(3).max(80),
    filename: z.string().trim().min(1).max(160).optional(),
    data_base64: z.string().min(8).max(7_500_000), // ~5.5 MB base64 ≈ ~5 MB binary
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ct = data.content_type.toLowerCase();
    if (!IMAGE_MIME.has(ct)) throw new Error("Unsupported image type");
    const buf = Buffer.from(data.data_base64, "base64");
    if (buf.byteLength === 0) throw new Error("Empty file");
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error("Image exceeds 5 MB limit");

    const ext = IMAGE_EXT[ct] ?? "bin";
    const safeBase = (data.filename ?? "image").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "image";
    const path = `${context.userId}/${Date.now()}-${crypto.randomUUID()}-${safeBase}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, buf, { contentType: ct, upsert: false });
    if (upErr) throw new Error(upErr.message);

    // 10-year signed URL (bucket is private; service-role signing bypasses RLS)
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl, path };
  });



/* ─────────────────────── Buy → ledger-backed escrow trade ─────────────────────── */
// Ledger-backed purchase for an order-book listing (selling thread).
export const buyListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ listing_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: l, error: lErr } = await supabaseAdmin
      .from("listings")
      .select("id, kind, status, amount, currency, user_id, name")
      .eq("id", data.listing_id)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!l) throw new Error("Listing not found");
    if (l.status !== "active") throw new Error("Listing unavailable");
    if (l.kind !== "selling") throw new Error("Only selling listings can be bought");
    if (l.user_id === userId) throw new Error("Cannot trade your own listing");
    if (!l.amount || Number(l.amount) <= 0) throw new Error("Listing has no price");

    const rate = await fetchBtcRate(l.currency || "USD");

    const { data: tradeId, error } = await supabaseAdmin.rpc("buy_listing", {
      _listing_id: l.id,
      _buyer: userId,
      _btc_rate: rate,
    });
    if (error) throw new Error(error.message);
    return { trade_id: tradeId as unknown as string };
  });


// Fetches a live BTC quote and opens a ledger-backed trade by calling the
// SECURITY DEFINER `buy_marketplace_product` RPC, which mints a one-shot
// internal offer and immediately runs `start_trade` (locks the buyer's
// available BTC into escrow). Returns the new trade id; the UI navigates
// to /trade/:id.
async function fetchBtcRate(fiat: string): Promise<number> {
  const cur = (fiat || "USD").toLowerCase();
  const supported = new Set(["usd", "eur", "gbp", "ngn", "cad", "aud", "jpy", "inr", "brl", "zar"]);
  const vs = supported.has(cur) ? cur : "usd";
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Rate fetch failed (${res.status})`);
  const j = (await res.json()) as { bitcoin?: Record<string, number> };
  const rate = Number(j?.bitcoin?.[vs]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid BTC rate");
  return rate;
}

export const buyProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: p, error: pErr } = await supabaseAdmin
      .from("marketplace_products")
      .select("id, price, currency, status, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!p) throw new Error("Product not found");
    if (p.status !== "active") throw new Error("Product unavailable");
    if (p.created_by === userId) throw new Error("Cannot buy your own product");

    const rate = await fetchBtcRate(p.currency || "USD");

    const { data: tradeId, error } = await supabaseAdmin.rpc("buy_marketplace_product", {
      _product_id: p.id,
      _buyer: userId,
      _btc_rate: rate,
    });
    if (error) throw new Error(error.message);
    return { trade_id: tradeId as unknown as string };
  });
