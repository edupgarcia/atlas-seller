import { startMercadoLivreAuthFn } from "./mercadolivre-oauth.functions";

/** Abre a autorização do Mercado Livre numa nova aba com state assinado pelo servidor. */
export async function openMercadoLivreAuth() {
  // Abre a aba no clique (evita bloqueio de pop-up) e só depois define o endereço.
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await startMercadoLivreAuthFn({
      data: { origin: window.location.origin },
    });
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
