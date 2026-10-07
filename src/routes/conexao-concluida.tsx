import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Página de retorno das janelas de autorização de marketplace (ex.: Mercado Livre).
// Mesma origem do app: avisa a aba do Atlas (BroadcastChannel + opener) e fecha sozinha.
export const OAUTH_CHANNEL = "atlas-oauth";
const SECONDS = 4;

export const Route = createFileRoute("/conexao-concluida")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conexão concluída — Atlas Seller" },
      { name: "description", content: "Resultado da conexão do marketplace com o Atlas Seller." },
      { property: "og:title", content: "Conexão concluída — Atlas Seller" },
      { property: "og:description", content: "Resultado da conexão do marketplace com o Atlas Seller." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const [state] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      provider: p.get("provider") ?? "ml",
      ok: p.get("status") === "ok",
      msg: p.get("msg") ?? "",
    };
  });
  const [left, setLeft] = useState(SECONDS);
  const [closeFailed, setCloseFailed] = useState(false);
  const back = `/configuracoes?${state.provider}=${state.ok ? "ok" : "erro"}&msg=${encodeURIComponent(state.msg)}`;

  useEffect(() => {
    const payload = { type: `${state.provider}-oauth`, ok: state.ok, msg: state.msg };
    try {
      const bc = new BroadcastChannel(OAUTH_CHANNEL);
      bc.postMessage(payload);
      bc.close();
    } catch { /* navegador sem BroadcastChannel */ }
  }, [state]);

  useEffect(() => {
    if (left <= 0) {
      window.close();
      const t = setTimeout(() => { if (!window.closed) setCloseFailed(true); }, 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const name = state.provider === "ml" ? "Mercado Livre" : "marketplace";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${state.ok ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {state.ok ? <CheckCircle2 className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          {state.ok ? "Conexão realizada com sucesso!" : "Não foi possível conectar"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.ok ? `Sua conta do ${name} já está ligada ao Atlas Seller.` : state.msg || `Tente conectar o ${name} novamente.`}
        </p>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-gold transition-all duration-1000" style={{ width: `${(Math.max(left, 0) / SECONDS) * 100}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {closeFailed
            ? "Pronto! Você já pode fechar esta janela."
            : `Esta janela será fechada automaticamente em ${Math.max(left, 0)}s…`}
        </p>
        <Button asChild className="mt-6 bg-gradient-gold text-[color:var(--primary-foreground)]">
          <a href={back}>Voltar ao Atlas Seller</a>
        </Button>
      </div>
    </div>
  );
}
