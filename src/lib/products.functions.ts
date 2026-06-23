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

type AnyProductRow = {
  card_number?: string | null;
  bin_number?: string | null;
  card_user?: string | null;
  card_address?: string | null;
  cvv?: string | null;
};

// Public projection — strip CVV + billing address, mask PAN + holder.
function publicMaskProduct<T extends AnyProductRow>(row: T): T {
  const bin = row.bin_number ?? (row.card_number ? String(row.card_number).replace(/\D/g, "").slice(0, 6) : null);
  return {
    ...row,
    card_number: publicCardNumber(row.card_number ?? null, bin),
    bin_number: bin,
    card_user: maskHolder(row.card_user ?? null),
    card_address: null,
    cvv: null,
  } as T;
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
    const products = (rows ?? []).map((r) => publicMaskProduct(r as AnyProductRow));
    return { products };
  });

export const lookupBinMetadata = createServerFn({ method: "GET" })
  .inputValidator(z.object({ card_number: z.string().trim().min(6).max(32) }))
  .handler(async ({ data }) => {
    const bin = data.card_number.replace(/\D/g, "").slice(0, 6);
    if (bin.length < 6) return { metadata: null };
    const { data: row, error } = await supabaseAdmin
      .from("bin_metadata")
      .select("bin_number,card_brand,card_type,card_bank,card_country,card_address,description")
      .eq("bin_number", bin)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { metadata: row ?? null };
  });

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
    return { product: publicMaskProduct(row as AnyProductRow) };
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

    // Preload real BIN reference data for realistic card seeding
    const { data: binRows } = await supabaseAdmin
      .from("bin_metadata")
      .select("bin_number,card_brand,card_type,card_bank,card_country");
    const bins = (binRows ?? []) as Array<{
      bin_number: string; card_brand: string | null; card_type: string | null;
      card_bank: string | null; card_country: string | null;
    }>;

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
          const bin = bins.length ? pick(bins) : null;
          const brand = bin?.card_brand ?? "Visa";
          const binNum = bin?.bin_number ?? "414720";
          const cardNumber = randomCardNumber(binNum, brand);
          const holder = randomName();
          base.name = `${bin?.card_bank ?? "Bank"} ${brand} ${bin?.card_type ?? "Credit"} — BIN ${binNum}`;
          base.description = `Real-BIN demo card from ${bin?.card_bank ?? "Issuer"} (${bin?.card_country ?? "US"}). Seeded for testing — purchase to reveal full PAN/CVV via escrow.`;
          base.card_number = cardNumber;
          base.bin_number = binNum;
          base.card_user = holder;
          base.card_type = bin?.card_type ?? "Credit";
          base.card_brand = brand;
          base.card_bank = bin?.card_bank ?? "Global Bank";
          base.card_country = bin?.card_country ?? "US";
          base.card_address = null;
          base.cvv = randomCVV(brand);
          base.expire_date = randomExpire();
        } else {
          base.name = templateName(cat);
          base.description = `[SEEDED DEMO] ${base.name} — replace with a real listing from the admin panel.`;
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

/* ─────────────────────── Buy → escrow group (reveals full details to parties) ─────────────────────── */
export const buyProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: p, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id, price, currency, seller_wallet_address, seller_wallet_asset, status, created_by, name, category, card_number, bin_number, card_user, card_type, card_brand, card_bank, card_country, card_address, cvv, expire_date")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Product not found");
    if (p.status !== "active") throw new Error("Product unavailable");
    if (p.created_by === userId) throw new Error("Cannot buy your own product");

    const asset = "BTC" as const;
    const fiatAmount = Number(p.price);
    const cryptoAmount = fiatAmount;

    const { data: g, error: gErr } = await supabaseAdmin.from("escrow_groups").insert({
      creator_id: userId,
      counterparty_id: p.created_by,
      listing_id: p.id,
      listing_name: p.name,
      listing_category: p.category,
      asset,
      amount: cryptoAmount,
      fiat_amount: fiatAmount,
      fiat_currency: p.currency,
      escrow_address: p.seller_wallet_address || null,
      escrow_address_chain: "BTC",
      status: "awaiting_counterparty",
      card_number: p.card_number || null,
      bin_number: p.bin_number || null,
      card_user: p.card_user || null,
      card_type: p.card_type || null,
      card_brand: p.card_brand || null,
      card_bank: p.card_bank || null,
      card_country: p.card_country || null,
      card_address: p.card_address || null,
      cvv: p.cvv || null,
      expire_date: p.expire_date || null,
    } as never).select("id").single();
    if (gErr) throw new Error(gErr.message);

    await supabaseAdmin.from("escrow_group_members").insert([
      { group_id: g.id, user_id: userId, role: "buyer", accepted_at: new Date().toISOString() },
      { group_id: g.id, user_id: p.created_by, role: "seller", accepted_at: null },
    ] as never);

    await supabaseAdmin.from("escrow_group_messages").insert({
      group_id: g.id,
      body: `Marketplace purchase opened for "${p.name}" — ${fiatAmount} ${p.currency}.`,
      is_system: true,
    } as never);

    return { id: g.id };
  });
