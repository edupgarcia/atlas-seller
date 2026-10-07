import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, requireSellerAccount } from "../supabase";

export default defineTool({
  name: "list_sku_costs",
  title: "Custos por SKU",
  description: "Lista os SKUs do seller e o custo de produto cadastrado para cada um.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const { supabase, accountId } = await requireSellerAccount(ctx);
      const { data: rows, error } = await supabase
        .from("vw_gross_profit_consolidated")
        .select("seller_sku,product_name")
        .eq("account_id", accountId)
        .not("seller_sku", "is", null);
      if (error) return errorResult(error.message);

      const unique = new Map<string, string>();
      for (const r of rows ?? []) {
        if (r.seller_sku && !unique.has(r.seller_sku)) unique.set(r.seller_sku, r.product_name ?? "—");
      }
      if (unique.size === 0) return jsonResult({ items: [] });

      const { data: costs, error: costsError } = await supabase
        .from("dim_seller_sku")
        .select("seller_sku,cost_product")
        .in("seller_sku", Array.from(unique.keys()));
      if (costsError) return errorResult(costsError.message);
      const costMap = new Map<string, number>();
      for (const c of costs ?? []) costMap.set(c.seller_sku, c.cost_product ?? 0);

      return jsonResult({
        items: Array.from(unique.entries()).map(([sku, name]) => ({
          seller_sku: sku,
          product_name: name,
          cost_product: costMap.get(sku) ?? 0,
        })),
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
