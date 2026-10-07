import { supabase } from "@/lib/supabase";
import { refreshAllFeeEstimates } from "./fees";

/**
 * Busca todos os SKUs distintos com seus preços e canais,
 * e atualiza as estimativas de tarifa via SP-API.
 *
 * Deve ser executado periodicamente (ex: diariamente ou a cada 6h).
 */
export async function refreshFeeEstimatesForAllSkus(accessToken: string) {
  // Busca SKUs distintos com preço e canal de fulfillment
  const { data: skus, error } = await supabase
    .from("fact_order_item")
    .select(`
      seller_sku_id,
      item_price_amount,
      dim_seller_sku!inner(seller_sku)
    `)
    .gt("quantity_ordered", 0)
    .order("item_price_amount", { ascending: false });

  if (error || !skus) {
    console.error("[refresh-fees] Erro ao buscar SKUs:", error);
    return;
  }

  // Agrupa por SKU + preço + canal (FBA vs DBA)
  const skuList: { sku: string; price: number; is_fba: boolean }[] = [];

  for (const row of skus) {
    const sku = (row.dim_seller_sku as any)?.seller_sku;
    if (!sku || !row.item_price_amount) continue;

    // Um para FBA, um para DBA
    skuList.push({ sku, price: parseFloat(row.item_price_amount), is_fba: true });
    skuList.push({ sku, price: parseFloat(row.item_price_amount), is_fba: false });
  }

  // Remove duplicatas
  const unique = Array.from(
    new Map(skuList.map((s) => [`${s.sku}-${s.price}-${s.is_fba}`, s])).values()
  );

  console.log(`[refresh-fees] Atualizando ${unique.length} estimativas...`);

  // Processa em lotes respeitando rate limit (1 req/s)
  await refreshAllFeeEstimates(unique, accessToken);

  console.log("[refresh-fees] Concluído.");
}