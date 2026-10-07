import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutSeller, refreshSeller, type Seller } from "@/lib/auth";
import { accessMessage } from "@/lib/access";

export const Route = createFileRoute("/sem-acesso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso não liberado — Atlas Seller" },
      { name: "description", content: "Sua conta ainda não tem acesso liberado ao Atlas Seller." },
      { property: "og:title", content: "Acesso não liberado — Atlas Seller" },
      { property: "og:description", content: "Sua conta ainda não tem acesso liberado ao Atlas Seller." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null | undefined>(undefined);

  useEffect(() => {
    refreshSeller()
      .then((s) => {
        if (!s) navigate({ to: "/login", replace: true });
        else if (s.access?.status === "active") navigate({ to: "/dashboard", replace: true });
        else setSeller(s);
      })
      .catch(() => navigate({ to: "/login", replace: true }));
  }, [navigate]);

  if (seller === undefined) return <div className="min-h-screen bg-background" />;
  const status = seller?.access?.status ?? "none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{accessMessage(status)}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O Atlas Seller está em fase de testes fechados. Fale com o administrador para liberar sua conta
          {seller?.email ? <> (<span className="text-foreground">{seller.email}</span>)</> : null}.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await logoutSeller();
            navigate({ to: "/login", replace: true });
          }}
        >
          Sair e entrar com outra conta
        </Button>
      </div>
    </div>
  );
}
