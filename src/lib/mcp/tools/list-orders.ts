import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireSellerAccount } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "Listar pedidos",
  description:
    "Lista os pedidos do seller no período, com SKU, quantidade, receita líquida e lucro bruto por item.",
  inputSchema: {
    from: z.string().describe("Data inicial ISO."),
    to: z.string().describe("Data final ISO."),
    seller_sku: z.string().trim().min(1).optional().describe("Filtrar por um SKU específico."),
    limit: z.number().int().min(1).max(200).default(50).describe("Máximo de linhas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, seller_sku, limit }, ctx) => {
    try {
      const { supabase, accountId } = await requireSellerAccount(ctx);
      let q = supabase
        .from("vw_gross_profit_consolidated")
        .select(
          "amazon_order_id,order_purchase_date,order_status,order_fulfillment_channel,seller_sku,product_name,quantity_ordered,net_revenue,gross_profit",
        )
        .gte("order_purchase_date", from)
        .lte("order_purchase_date", to)
        .order("order_purchase_date", { ascending: false })
        .limit(limit ?? 50)
        .eq("account_id", accountId);
      if (seller_sku) q = q.eq("seller_sku", seller_sku);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return jsonResult({ count: data?.length ?? 0, orders: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
