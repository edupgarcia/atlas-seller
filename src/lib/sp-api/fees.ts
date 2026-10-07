/**
 * Chama o endpoint getMyFeesEstimateForSKU da Amazon SP-API
 * e armazena o resultado na tabela marketplace_fee_estimates.
 *
 * Endpoint: POST /products/fees/v0/listings/{SellerSKU}/feesEstimate
 * Rate limit: 1 req/s, burst 2
 *
 * FeeType valores retornados:
 * - ReferralFee          → comissão (% do preço)
 * - FBAFulfillmentFee    → tarifa FBA (pick/pack/ship)
 *   ├─ FBAPickPackFee
 *   ├─ FBAWeightBasedFee
 *   └─ FBAOrderHandlingFee
 * - VariableClosingFee   → taxa fixa por item
 * - FBAReturnFee         → taxa de devolução (se aplicável)
 */

import { supabase } from "@/lib/supabase";

const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";
const MARKETPLACE_ID_BR = "A2Q3Y263D00KWC"; // Amazon.com.br

interface FeeDetail {
  FeeType: string;
  FeeAmount: { Amount: number; CurrencyCode: string };
  FinalFee: { Amount: number; CurrencyCode: string };
  FeePromotion?: { Amount: number; CurrencyCode: string };
  TaxAmount?: { Amount: number; CurrencyCode: string };
}

interface FeesEstimateResult {
  Status: "Success" | "ClientError" | "ServiceError";
  FeesEstimate?: {
    TotalFeesEstimate: { Amount: number; CurrencyCode: string };
    FeeDetailList: FeeDetail[];
    TimeOfFeesEstimation: string;
  };
  Error?: { code: string; message: string; detail?: string };
}

export async function getAndStoreFeeEstimate(
  sellerSku: string,
  listingPrice: number,
  isFba: boolean,
  accessToken: string
): Promise<void> {
  const url = `${SP_API_BASE}/products/fees/v0/listings/${encodeURIComponent(sellerSku)}/feesEstimate`;

  const body = {
    FeesEstimateRequest: {
      MarketplaceId: MARKETPLACE_ID_BR,
      IsAmazonFulfilled: isFba,
      PriceToEstimateFees: {
        ListingPrice: {
          Amount: listingPrice.toFixed(2),
          CurrencyCode: "BRL",
        },
      },
      Identifier: `atlas-${sellerSku}-${Date.now()}`,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amz-access-token": accessToken,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`[fees] HTTP ${response.status} for SKU ${sellerSku}`);
    return;
  }

  const data = await response.json();
  const result: FeesEstimateResult = data?.payload?.FeesEstimateResult ?? data?.FeesEstimateResult;

  if (!result || result.Status !== "Success" || !result.FeesEstimate) {
    console.error(`[fees] Status=${result?.Status} for SKU ${sellerSku}:`, result?.Error);
    return;
  }

  // Extrair tarifas por FeeType
  const feeMap = new Map<string, number>();
  for (const detail of result.FeesEstimate.FeeDetailList ?? []) {
    feeMap.set(detail.FeeType, detail.FinalFee?.Amount ?? 0);
  }

  const referralFee = feeMap.get("ReferralFee") ?? 0;
  const fbaFee = feeMap.get("FBAFulfillmentFee") ?? 0;
  const closingFee = feeMap.get("VariableClosingFee") ?? 0;
  const totalFees = result.FeesEstimate.TotalFeesEstimate?.Amount ?? 0;

  // Upsert no Supabase
  await supabase.from("marketplace_fee_estimates").upsert(
    {
      seller_sku: sellerSku,
      marketplace_id: MARKETPLACE_ID_BR,
      listing_price: listingPrice,
      is_fba: isFba,
      referral_fee: referralFee,
      fba_fulfillment_fee: fbaFee,
      variable_closing_fee: closingFee,
      total_fees: totalFees,
      estimated_at: new Date().toISOString(),
      status: "success",
      raw_response: result,
    },
    {
      onConflict: "seller_sku,marketplace_id,listing_price,is_fba",
    }
  );
}

/**
 * Processa em lote todos os SKUs que precisam de estimativa.
 * Respeita o rate limit de 1 req/s.
 */
export async function refreshAllFeeEstimates(
  skus: { sku: string; price: number; is_fba: boolean }[],
  accessToken: string
): Promise<void> {
  for (const { sku, price, is_fba } of skus) {
    await getAndStoreFeeEstimate(sku, price, is_fba, accessToken);
    await new Promise((r) => setTimeout(r, 1100)); // 1.1s entre requests
  }
}