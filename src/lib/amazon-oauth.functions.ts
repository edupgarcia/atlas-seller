import { createServerFn } from "@tanstack/react-start";

// Sem parâmetros de entrada: a identidade vem exclusivamente da sessão assinada.
export const startAmazonAuthFn = createServerFn({ method: "POST" }).handler(async () => {
  const { buildAmazonAuthUrl } = await import("./amazon-oauth.server");
  return buildAmazonAuthUrl();
});
