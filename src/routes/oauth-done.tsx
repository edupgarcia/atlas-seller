import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/oauth-done")({
  ssr: false,
  component: Page,
});

const TOTAL = 5;

function Page() {
  const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const ok = p.get("ml") === "ok";
  const msg = p.get("msg") ?? (ok ? "Conta conectada ao Atlas Seller!" : "Não foi possível conectar.");

  const [hasOpener] = useState(() => {
    try { return typeof window !== "undefined" && !!window.opener && !window.opener.closed; }
    catch { return false; }
  });
  const [acked, setAcked] = useState(false);
  const [left, setLeft] = useState(TOTAL);

  // avisa a aba do Atlas (repete até receber a confirmação)
  useEffect(() => {
    if (!hasOpener) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "ml-oauth-ack") setAcked(true);
    };
    window.addEventListener("message", onMsg);
    const send = () => {
      try { window.opener?.postMessage({ type: "ml-oauth", ok, msg }, window.location.origin); } catch {}
    };
    send();
    const t = setInterval(send, 500);
    return () => { clearInterval(t); window.removeEventListener("message", onMsg); };
  }, [hasOpener, ok, msg]);

  // contagem e fechamento (só quando a janela foi aberta pelo Atlas)
  useEffect(() => {
    if (!hasOpener) return;
    if (acked && left > 1) { setLeft(1); return; }
    if (left <= 0) { try { window.close(); } catch {} return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [hasOpener, acked, left]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          {ok ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <XCircle className="h-8 w-8 text-red-500" />}
        </div>
        <h1 className="mb-2 text-xl font-bold">
          {ok ? "Conexão realizada com sucesso!" : "Não foi possível conectar"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">{msg}</p>

        {hasOpener ? (
          <p className="text-xs text-muted-foreground">
            Esta janela será fechada em {Math.max(left, 0)}s. Se não fechar, você pode fechá-la e voltar ao Atlas Seller.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Você já pode fechar esta janela e voltar ao Atlas Seller.
          </p>
        )}
      </div>
    </div>
  );
}