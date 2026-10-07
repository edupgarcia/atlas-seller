import { startTemuAuthFn } from "./temu-oauth.functions";

/** Abre a autorização Temu numa nova aba com state assinado pelo servidor. */
export async function openTemuAuth() {
  const tab = window.open("about:blank", "_blank");
  try {
    const { url } = await startTemuAuthFn();
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
