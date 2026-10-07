import { adminClient, requireSessionSeller } from "./session.server";

const admin = adminClient;

export async function fetchConsolidatedServer(params: {
  from?: string;
  to?: string;
  limit?: number;
}) {
  const seller = await requireSessionSeller();

  // 🔎 DEBUG — mostra quem a sessão está identificando
  console.log("🔎 ATLAS SESSION:", {
    sellerId: seller.id,
    email: seller.email,
    marketplaceAccountId: seller.marketplace_account_id,
  });

  // Sem conta de marketplace vinculada, o seller não pode ver nenhum dado.
  if (!seller.marketplace_account_id) return [];

  const supabase = admin();

  console.log(
    "🔎 ATLAS QUERY ACCOUNT:",
    seller.marketplace_account_id
  );

  let q = supabase
    .from("vw_gross_profit_consolidated")
    .select("*")
    .eq("account_id", seller.marketplace_account_id)
    .order("order_purchase_date", { ascending: false })
    .limit(params.limit ?? 5000);

  // ✅ Filtro de datas considerando timezone BRT (GMT-3)
  if (params.from && params.to) {
    const fromStr = params.from.substring(0, 10);
    const toStr = params.to.substring(0, 10);

    if (fromStr === toStr) {
      const brtStart = `${fromStr}T03:00:00.000Z`;
      const nextDate = new Date(fromStr + "T00:00:00.000Z");
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDay = nextDate.toISOString().substring(0, 10);
      const brtEnd = `${nextDay}T03:00:00.000Z`;

      q = q.gte("order_purchase_date", brtStart);
      q = q.lt("order_purchase_date", brtEnd);
    } else {
      q = q.gte("order_purchase_date", params.from);
      q = q.lte("order_purchase_date", params.to);
    }
  } else {
    if (params.from) q = q.gte("order_purchase_date", params.from);
    if (params.to) q = q.lte("order_purchase_date", params.to);
  }

  const { data, error } = await q;

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) return [];
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function upsertProductCostServer(
  seller_sku: string,
  cost_product: number
) {
  const seller = await requireSessionSeller();

  if (!seller.marketplace_account_id) {
    throw new Error("Conta Amazon não conectada.");
  }

  const supabase = admin();

  // Só permite alterar SKUs que aparecem nos pedidos desta conta.
  const { count, error: ownsError } = await supabase
    .from("vw_gross_profit_consolidated")
    .select("seller_sku", { count: "exact", head: true })
    .eq("seller_sku", seller_sku)
    .eq("account_id", seller.marketplace_account_id);

  if (ownsError) throw new Error(ownsError.message);
  if (!count) {
    throw new Error(`SKU ${seller_sku} não pertence a esta conta.`);
  }

  const { error } = await supabase
    .from("dim_seller_sku")
    .update({ cost_product })
    .eq("seller_sku", seller_sku);

  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function hasMarketplaceAccountServer(): Promise<boolean> {
  const seller = await requireSessionSeller();
  return Boolean(seller.marketplace_account_id);
}

export async function listSkuCostsServer() {
  const seller = await requireSessionSeller();

  if (!seller.marketplace_account_id) return [];

  const supabase = admin();

  const { data: orders, error: ordersError } = await supabase
    .from("vw_gross_profit_consolidated")
    .select("seller_sku, product_name")
    .eq("account_id", seller.marketplace_account_id)
    .not("seller_sku", "is", null)
    .order("seller_sku", { ascending: true });

  if (ordersError) throw new Error(ordersError.message);

  const uniqueSkus = new Map<string, string>();

  for (const row of orders ?? []) {
    if (row.seller_sku && !uniqueSkus.has(row.seller_sku)) {
      uniqueSkus.set(row.seller_sku, row.product_name ?? "—");
    }
  }

  if (uniqueSkus.size === 0) return [];

  const { data: costs, error: costsError } = await supabase
    .from("dim_seller_sku")
    .select("seller_sku, cost_product")
    .in("seller_sku", Array.from(uniqueSkus.keys()));

  if (costsError) throw new Error(costsError.message);

  const costMap = new Map<string, number>();

  for (const row of costs ?? []) {
    costMap.set(row.seller_sku, row.cost_product ?? 0);
  }

  return Array.from(uniqueSkus.entries()).map(([sku, name]) => ({
    seller_sku: sku,
    product_name: name,
    cost_product: costMap.get(sku) ?? 0,
  }));
}

export async function reprocessCostsServer(params: {
  sku: string;
  from: string;
  to: string;
}) {
  const seller = await requireSessionSeller();

  if (!seller.marketplace_account_id) {
    throw new Error("Conta Amazon não conectada.");
  }

  const supabase = admin();

  const { error } = await supabase.rpc("reprocess_costs", {
    p_sku: params.sku,
    p_from: params.from,
    p_to: params.to,
    p_account_id: seller.marketplace_account_id,
  });

  if (error) throw new Error(error.message);

  return { ok: true };
}

import { createClient } from "@supabase/supabase-js";
import { buildSignedState } from "./amazon-oauth.server";

export async function getMercadoLivreAccountServer() {
  // seller vem da sessão (mesmo helper que o fluxo OAuth já usa)
  const { seller } = await buildSignedState();

  const supabase = createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("marketplace_accounts")
    .select("id, seller_name, merchant_id, marketplace_id")
    .eq("marketplace_provider", "3")
    .eq("seller_id", seller.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data; // null se não conectado
}