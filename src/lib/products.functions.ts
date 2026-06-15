import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ASSETS = ["BTC", "USDT", "USDC", "ETH"] as const;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

// Public browse
export const listProducts = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ q: z.string().max(120).optional(), category: z.string().max(60).optional() })
      .optional()
      .transform((v) => v ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("marketplace_products")
      .select("id,name,description,category,price,currency,image_url,stock,status,is_featured,created_at,seller_wallet_asset,card_number,bin_number,card_type,card_bank,card_user")
      .eq("status", "active")
      .neq("category", "BIN")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.q) {
      const needle = `%${data.q}%`;
      q = q.or(
        `name.ilike.${needle},description.ilike.${needle},card_number.ilike.${needle},bin_number.ilike.${needle},card_bank.ilike.${needle},card_type.ilike.${needle},card_user.ilike.${needle}`,
      );
    }
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { products: rows ?? [] };
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

// Public single-product fetch for the product detail page
export const getProduct = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_products")
      .select("id,name,description,category,price,currency,image_url,stock,status,is_featured,created_at,seller_wallet_asset,seller_wallet_address,card_number,bin_number,card_user,card_type,card_brand,card_bank,card_country,card_address")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Product not found");
    return { product: row };
  });

// Admin dev tool: seed N sample products for one category (or all four when omitted)
export const adminSeedSampleProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      perCategory: z.number().int().min(1).max(50).default(10),
      category: z.enum(["BIN", "Enroll", "Scanner", "Combo"]).optional(),
    }).optional().transform((v) => v ?? { perCategory: 10 }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const cats = (data.category ? [data.category] : ["BIN", "Enroll", "Scanner", "Combo"]) as Array<"BIN"|"Enroll"|"Scanner"|"Combo">;
    const rows: Array<Record<string, unknown>> = [];
    for (const cat of cats) {
      for (let i = 1; i <= data.perCategory; i++) {
        const price = Math.round((10 + Math.random() * 290) * 100) / 100;
        const row: Record<string, unknown> = {
          name: `${cat} Sample #${i}`,
          description: `Demo ${cat} product #${i} — replace with real listing details from the admin panel.`,
          category: cat,
          price,
          currency: "USD",
          image_url: null,
          stock: -1,
          seller_wallet_asset: "BTC",
          is_featured: i === 1,
          status: "active",
          created_by: context.userId,
        };
        if (cat === "BIN") {
          row.card_number = `4${String(1000000000000000 + i).slice(1, 16)}`;
          row.bin_number = "412345";
          row.card_user = `Cardholder ${i}`;
          row.card_type = i % 2 === 0 ? "Credit" : "Debit";
          row.card_brand = "Visa";
          row.card_bank = "Global Bank";
          row.card_country = "US";
          row.card_address = "New York, NY";
          row.cvv = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
          const expMonth = String((i % 12) + 1).padStart(2, "0");
          const expYear = String((2025 + Math.floor(i / 12)) % 100).padStart(2, "0");
          row.expire_date = `${expMonth}/${expYear}`;
        }
        rows.push(row);
      }
    }
    const { error } = await supabaseAdmin.from("marketplace_products").insert(rows as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

// Admin: list all (any status)
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
    seller_wallet_asset: z.enum(ASSETS).default("USDT"),
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

// Buy → auto-create an escrow group between buyer and product owner (admin)
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

    const asset = (p.seller_wallet_asset || "USDT") as "BTC" | "USDT" | "USDC" | "ETH";
    const fiatAmount = Number(p.price);
    const cryptoAmount = fiatAmount; // 1:1 placeholder for stablecoins; real conversion happens off-platform

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
      escrow_address_chain: asset === "USDT" ? "TRC20" : asset === "USDC" ? "ERC20" : asset,
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
