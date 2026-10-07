import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyAccount from "./tools/get-my-account";
import getSalesSummary from "./tools/get-sales-summary";
import listOrders from "./tools/list-orders";
import listSkuCosts from "./tools/list-sku-costs";
import setSkuCost from "./tools/set-sku-cost";

// O issuer OAuth precisa ser o host direto do Supabase (nunca um proxy).
const projectRef =
  import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "omvtqftgbkdthgfypjlx";

export default defineMcp({
  name: "atlas-seller",
  title: "Atlas Seller",
  version: "0.1.0",
  instructions:
    "Ferramentas do Atlas Seller (inteligência de dados para vendedores Amazon). Use get_my_account para identificar a conta, get_sales_summary para KPIs de vendas e lucro, list_orders para pedidos detalhados, list_sku_costs e set_sku_cost para custos por SKU. Valores em BRL.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyAccount, getSalesSummary, listOrders, listSkuCosts, setSkuCost],
});
