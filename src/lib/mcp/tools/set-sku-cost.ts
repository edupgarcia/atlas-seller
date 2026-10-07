import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireSellerAccount } from "../supabase";

export default defineTool({
  name: "set_sku_cost",
  title: "Atualizar custo de um SKU",
  description:
    "Grava o custo de produto (cost_product) de um SKU do seller, usado no cálculo de lucro bruto.",
  inputSchema: {
    seller_sku: z.string().trim().min(1).describe("SKU do seller."),
    cost_product: z.number().min(0).describe("Novo custo unitário do produto, em BRL."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ seller_sku, cost_product }, ctx) => {
    try {
      const { supabase, accountId } = await requireSellerAccount(ctx);

      // Só permite alterar SKUs que aparecem nos pedidos deste seller.
      const { count, error: ownsError } = await supabase
        .from("vw_gross_profit_consolidated")
        .select("seller_sku", { count: "exact", head: true })
        .eq("seller_sku", seller_sku)
        .eq("account_id", accountId);
      if (ownsError) return errorResult(ownsError.message);
      if (!count) return errorResult(`SKU ${seller_sku} não pertence a esta conta.`);

      const { error } = await supabase
        .from("dim_seller_sku")
        .update({ cost_product })
        .eq("seller_sku", seller_sku);
      if (error) return errorResult(error.message);
      return jsonResult({ ok: true, seller_sku, cost_product });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
