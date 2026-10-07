import { createServerFn } from "@tanstack/react-start";

export const fetchConsolidatedFn = createServerFn({ method: "POST" })
  .inputValidator((data: { from?: string; to?: string; limit?: number }) => data ?? {})
  .handler(async ({ data }) => {
    const { fetchConsolidatedServer } = await import("./queries.server");
    return fetchConsolidatedServer(data);
  });

export const upsertProductCostFn = createServerFn({ method: "POST" })
  .inputValidator((data: { seller_sku: string; cost_product: number }) => {
    if (!data || typeof data.seller_sku !== "string" || typeof data.cost_product !== "number") {
      throw new Error("Dados inválidos");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { upsertProductCostServer } = await import("./queries.server");
    return upsertProductCostServer(data.seller_sku, data.cost_product);
  });

export const hasMarketplaceAccountFn = createServerFn({ method: "GET" }).handler(async () => {
  const { hasMarketplaceAccountServer } = await import("./queries.server");
  return hasMarketplaceAccountServer();
});

export const listSkuCostsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listSkuCostsServer } = await import("./queries.server");
  return listSkuCostsServer();
});

export const reprocessCostsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sku: string; from: string; to: string }) => {
    if (!data || typeof data.sku !== "string" || !data.from || !data.to) {
      throw new Error("Dados inválidos");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { reprocessCostsServer } = await import("./queries.server");
    return reprocessCostsServer(data);
  });

  export const getMercadoLivreAccountFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getMercadoLivreAccountServer } = await import("./queries.server");
  return getMercadoLivreAccountServer();
});
