import { startAmazonAuthFn } from "./amazon-oauth.functions";

/** Abre a autorização Amazon numa nova aba com um state assinado pelo servidor. */
export async function openAmazonAuth() {
  // Abre a aba no clique (evita bloqueio de pop-up) e só depois define o endereço.
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await startAmazonAuthFn();
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
