import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireSellerAccount } from "../supabase";

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

export default defineTool({
  name: "get_sales_summary",
  title: "Resumo de vendas e lucro",
  description:
    "KPIs consolidados (receita, lucro bruto, margem, pedidos, ticket médio) do seller no período informado, com quebra por canal FBA/DBA.",
  inputSchema: {
    from: z.string().describe("Data inicial ISO (ex.: 2026-01-01)."),
    to: z.string().describe("Data final ISO (ex.: 2026-01-31)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    try {
      const { supabase, accountId } = await requireSellerAccount(ctx);
      const { data, error } = await supabase
        .from("vw_gross_profit_consolidated")
        .select("*")
        .eq("account_id", accountId)
        .gte("order_purchase_date", from)
        .lte("order_purchase_date", to)
        .limit(5000);
      if (error) return errorResult(error.message);

      const rows = data ?? [];
      const revenue = rows.reduce((a, r) => a + num(r.net_revenue), 0);
      const profit = rows.reduce((a, r) => a + num(r.gross_profit), 0);
      const orders = new Set(rows.map((r) => r.amazon_order_id)).size;
      const channels: Record<string, { revenue: number; profit: number }> = {};
      for (const r of rows) {
        const raw = String(r.order_fulfillment_channel ?? "").toUpperCase();
        const key = raw.includes("AFN") || raw.includes("FBA") ? "FBA" : "DBA";
        channels[key] ??= { revenue: 0, profit: 0 };
        channels[key].revenue += num(r.net_revenue);
        channels[key].profit += num(r.gross_profit);
      }

      return jsonResult({
        period: { from, to },
        currency: "BRL",
        net_revenue: revenue,
        gross_profit: profit,
        margin_pct: revenue ? (profit / revenue) * 100 : 0,
        orders,
        average_order_value: orders ? revenue / orders : 0,
        by_channel: channels,
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
