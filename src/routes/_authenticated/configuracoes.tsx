import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/money-text";
import { useSeller } from "@/hooks/use-seller";
import { updateSellerProfile } from "@/lib/auth";
import { listSkuCosts, upsertProductCost, getMercadoLivreAccount } from "@/lib/queries";
import { openAmazonAuth } from "@/lib/amazon-oauth";
import { openTemuAuth } from "@/lib/temu-oauth";
import { openMercadoLivreAuth } from "@/lib/mercadolivre-oauth";
import { SUPABASE_URL } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — Atlas Seller" }] }),
  component: Page,
});

function Page() {
  const { seller } = useSeller();
  const [name, setName] = useState(seller?.name ?? "");
  const [email, setEmail] = useState(seller?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [waitingMl, setWaitingMl] = useState(false);

  const qc = useQueryClient();

  // Status da conexão Mercado Livre (consulta a cada 3s enquanto aguarda a autorização)
  const ml = useQuery({
    queryKey: ["ml-account"],
    queryFn: () => getMercadoLivreAccount(),
    enabled: !!seller,
    refetchInterval: waitingMl ? 3000 : false,
  });

  // Para de aguardar quando a conta aparece
  useEffect(() => {
    if (ml.data) setWaitingMl(false);
  }, [ml.data]);

  // Segurança: desliga a espera após 2 minutos
  useEffect(() => {
    if (!waitingMl) return;
    const t = setTimeout(() => setWaitingMl(false), 120000);
    return () => clearTimeout(t);
  }, [waitingMl]);

  // NOVO: recebe o resultado enviado pela página /oauth-done (aba/pop-up do ML)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "ml-oauth") return;
      if (e.data.ok) toast.success(e.data.msg || "Mercado Livre conectado");
      else toast.error(e.data.msg || "Não foi possível conectar o Mercado Livre");
      setWaitingMl(false);
      qc.invalidateQueries({ queryKey: ["ml-account"] });
    };
    window.addEventListener("message", h);
    // a página /conexao-concluida também avisa por BroadcastChannel (funciona mesmo sem opener)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("atlas-oauth");
      bc.onmessage = (ev) => h(new MessageEvent("message", { data: ev.data, origin: window.location.origin }));
    } catch { /* sem suporte */ }
    return () => {
      window.removeEventListener("message", h);
      bc?.close();
    };
  }, [qc]);

  // Fallback: resultado via URL (?ml=ok|erro&msg=...), caso o retorno caia nesta página
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mlParam = params.get("ml");
    if (!mlParam) return;
    const msg = params.get("msg") ?? "";
    if (mlParam === "ok") {
      toast.success(msg || "Mercado Livre conectado");
      qc.invalidateQueries({ queryKey: ["ml-account"] });
    } else {
      toast.error(msg || "Não foi possível conectar o Mercado Livre");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [qc]);

  const q = useQuery({
    queryKey: ["sku-costs"],
    queryFn: () => listSkuCosts(),
    enabled: !!seller,
  });

  const skuCosts = useMemo(() => {
    return (q.data ?? []).map((r: { seller_sku: string; product_name: string | null; cost_product: number | null }) => ({
      sku: r.seller_sku,
      name: r.product_name ?? "—",
      cost_product: r.cost_product ?? 0,
      cost_status: "ok",
    }));
  }, [q.data]);

  return (
    <div className="min-h-screen space-y-4 p-4 sm:space-y-6 sm:p-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Configurações</h1>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Perfil</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button
              disabled={saving || !seller}
              onClick={async () => {
                if (!seller) return;
                setSaving(true);
                try {
                  await updateSellerProfile({ name, email });
                  toast.success("Perfil atualizado");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
                } finally {
                  setSaving(false);
                }
              }}
              className="bg-gradient-gold text-[color:var(--primary-foreground)]"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Conexão Amazon</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {seller?.marketplace_account_id ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
              <div>
                <p className="text-sm font-medium">Conectado</p>
                <p className="text-xs text-muted-foreground">
                  Marketplace Account ID: <span className="font-mono">{seller.marketplace_account_id}</span>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <Badge variant="outline" className="border-[color:var(--warning)] text-[color:var(--warning)]">
                Não conectado
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                Autorize a Amazon para começar a sincronizar seus dados.
              </p>
            </div>
          )}
          <Button className="bg-gradient-gold text-[color:var(--primary-foreground)]" onClick={() => openAmazonAuth().catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão"))}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {seller?.marketplace_account_id ? "Reconectar" : "Conectar Amazon"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Conexão Temu</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Autorize sua loja Temu para o Atlas Seller receber seus dados.
          </p>
          <Button className="bg-gradient-gold text-[color:var(--primary-foreground)]" onClick={() => openTemuAuth().catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão"))}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Conectar Temu
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Conexão Mercado Livre</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {ml.data ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
              <div>
                <p className="text-sm font-medium">Conectado</p>
                <p className="text-xs text-muted-foreground">
                  {ml.data.seller_name ?? "Mercado Livre"} · ID ML:{" "}
                  <span className="font-mono">{ml.data.merchant_id}</span>
                </p>
              </div>
            </div>
          ) : (
            <div>
              <Badge variant="outline" className="border-[color:var(--warning)] text-[color:var(--warning)]">
                {waitingMl ? "Aguardando autorização..." : "Não conectado"}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                Autorize sua conta do Mercado Livre para o Atlas Seller receber seus dados.
              </p>
            </div>
          )}
          <Button
            className="bg-gradient-gold text-[color:var(--primary-foreground)]"
            onClick={() => {
              setWaitingMl(true);
              openMercadoLivreAuth().catch((e) => {
                setWaitingMl(false);
                toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão");
              });
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {ml.data ? "Reconectar" : "Conectar Mercado Livre"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Custos por SKU</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Produto</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo Atual</th>
                  <th className="py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {skuCosts.map((s) => (
                  <CostRow key={s.sku} row={s} onSaved={() => qc.invalidateQueries({ queryKey: ["sku-costs"] })} />
                ))}
                {skuCosts.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">
                    {q.isLoading ? "Carregando..." : "Sem SKUs."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Os custos são gravados na tabela <span className="font-mono">dim_seller_sku</span>{" "}
            (coluna <span className="font-mono">cost_product</span>) do Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CostRow({ row, onSaved }: { row: { sku: string; name: string; cost_product: number; cost_status: string }; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.cost_product ?? 0));
  const [saving, setSaving] = useState(false);

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-3 pr-4 font-mono text-xs">{row.sku}</td>
      <td className="py-3 pr-4">{row.name}</td>
      <td className="py-3 pr-4 text-right">
        {editing ? (
          <Input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="ml-auto h-8 w-32"
          />
        ) : (
          <MoneyText value={row.cost_product} />
        )}
      </td>
      <td className="py-3">
        {editing ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={saving}
              className="bg-gradient-gold text-[color:var(--primary-foreground)]"
              onClick={async () => {
                setSaving(true);
                const cost = Number(value);
                if (!isFinite(cost)) { toast.error("Valor inválido"); setSaving(false); return; }
                try {
                  await upsertProductCost(row.sku, cost);
                  toast.success("Custo atualizado");
                  setEditing(false);
                  onSaved();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao salvar");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-3 w-3" /> Editar
          </Button>
        )}
      </td>
    </tr>
  );
}