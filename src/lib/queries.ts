import {
  fetchConsolidatedFn,
  upsertProductCostFn,
  listSkuCostsFn,
  getMercadoLivreAccountFn,
} from "./queries.functions";

export type ConsolidatedRow = {
  amazon_order_id: string;
  seller_sku: string;
  product_name: string | null;
  posted_date: string | null;
  order_purchase_date: string | null;
  order_status: string | null;
  order_fulfillment_channel: string | null;
  sales_channel: string | null;
  account_id: string | null;
  order_item_id: string | null;
  quantity_ordered: number | null;
  item_price_amount: number | null;
  item_revenue: number | null;
  promotion_discount: number | null;
  cost_product: number | null;
  cost_status: string | null;
  principal: number | null;
  shipping_charge: number | null;
  tax: number | null;
  fba_fee: number | null;
  commission: number | null;
  total_fees: number | null;
  mfn_postage_fee: number | null;
  mfn_shipping_chargeback: number | null;
  total_service_fees: number | null;
  net_revenue: number | null;
  gross_profit: number | null;
};

export type MercadoLivreAccount = {
  id: string;
  seller_name: string | null;
  merchant_id: string | null;
  marketplace_id: string | null;
};

export async function fetchConsolidated(params: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ConsolidatedRow[]> {
  const data = (await fetchConsolidatedFn({ data: params })) as ConsolidatedRow[];
  return data ?? [];
}

export async function upsertProductCost(seller_sku: string, cost_product: number) {
  return upsertProductCostFn({ data: { seller_sku, cost_product } });
}

export async function listSkuCosts() {
  return listSkuCostsFn();
}

/** Conta Mercado Livre vinculada ao seller da sessão (null se não conectada). */
export async function getMercadoLivreAccount(): Promise<MercadoLivreAccount | null> {
  return (await getMercadoLivreAccountFn()) as MercadoLivreAccount | null;
}