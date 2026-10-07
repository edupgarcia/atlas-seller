import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthDetails = {
  client?: { name?: string | null; redirect_uri?: string | null } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acesso — Atlas Seller" },
      { name: "description", content: "Autorize um aplicativo externo a acessar seus dados do Atlas Seller." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id");
    if (!authorizationId) throw new Error("Parâmetro authorization_id ausente.");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { needsAuth: true as const, details: null };
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return { needsAuth: false as const, details: data, email: sessionData.session.user.email };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-lg font-semibold">Não foi possível carregar a autorização</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function SignInCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(mode: "in" | "up") {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.href },
          });
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    if (mode === "up" && !res.data.session) {
      setBusy(false);
      setInfo("Confirme o e-mail enviado e volte a esta página para concluir.");
      return;
    }
    window.location.reload();
  }

  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">Entrar para autorizar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use o mesmo e-mail da sua conta Atlas Seller — é por ele que suas vendas e custos
          são identificados.
        </p>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        <div className="flex gap-2">
          <Button
            disabled={busy || !email || !password}
            onClick={() => run("in")}
            className="bg-gradient-gold text-[color:var(--primary-foreground)]"
          >
            Entrar
          </Button>
          <Button variant="outline" disabled={busy || !email || !password} onClick={() => run("up")}>
            Criar acesso
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Consent() {
  const loaded = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  if (loaded.needsAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <SignInCard />
      </main>
    );
  }

  const clientName = loaded.details?.client?.name ?? "um aplicativo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Conectar {clientName} ao Atlas Seller</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conectado como <span className="font-medium text-foreground">{loaded.email}</span>.
          </p>
          <p className="text-sm">
            Isso permite que {clientName} use o Atlas Seller como você: consultar suas vendas,
            lucro e pedidos, e atualizar custos por SKU.
          </p>
          {loaded.details?.client?.redirect_uri && (
            <p className="break-all text-xs text-muted-foreground">
              Redireciona para: <span className="font-mono">{loaded.details.client.redirect_uri}</span>
            </p>
          )}
          {loaded.details?.scope && (
            <p className="text-xs text-muted-foreground">
              Permissões de identidade solicitadas: {loaded.details.scope}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Isso não ignora as permissões do app nem as políticas do backend.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => decide(true)}
              className="bg-gradient-gold text-[color:var(--primary-foreground)]"
            >
              Autorizar
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
              Cancelar conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
