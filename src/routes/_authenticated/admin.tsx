import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { grantAccessFn, listUsersFn, updateAccessFn } from "@/lib/admin.functions";
import { getStoredSeller } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  // só esconde a tela; quem garante a restrição são as funções do servidor (requireAdmin)
  beforeLoad: ({ context }) => {
    const s = (context as { seller?: { access?: { is_admin?: boolean } } }).seller ?? getStoredSeller();
    if (!s?.access?.is_admin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Usuários e acessos — Atlas Seller" },
      { name: "description", content: "Gerencie quem pode usar o Atlas Seller." },
      { property: "og:title", content: "Usuários e acessos — Atlas Seller" },
      { property: "og:description", content: "Gerencie quem pode usar o Atlas Seller." },
    ],
  }),
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
  expired: "Expirado",
  none: "Sem acesso",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function fmtTime(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function StatusPill({ s }: { s: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        s === "active" && "bg-[color:var(--success)]/15 text-[color:var(--success)]",
        s === "invited" && "bg-primary/15 text-primary",
        (s === "suspended" || s === "expired" || s === "none") && "bg-destructive/15 text-destructive",
      )}
    >
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsersFn() });
  const me = getStoredSeller();

  async function patch(data: Parameters<typeof updateAccessFn>[0]["data"], ok: string) {
    try {
      await updateAccessFn({ data });
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ShieldCheck className="h-6 w-6 text-primary" /> Usuários e acessos
          </h1>
          <p className="text-sm text-muted-foreground">Quem pode usar o Atlas Seller durante os testes fechados.</p>
        </div>
        <GrantDialog onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : q.error ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Ativado</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data?.users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {u.name ?? "—"} {u.is_admin && <Badge variant="outline" className="ml-1 border-primary/40 text-primary">admin</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell><StatusPill s={u.effective} /></TableCell>
                    <TableCell>
                      <Select
                        value={u.access_type === "-" ? undefined : u.access_type}
                        onValueChange={(v) => patch({ user_id: u.user_id, access_type: v }, "Tipo de acesso alterado")}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beta">Beta</SelectItem>
                          <SelectItem value="licensed">Licenciado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.plan_code ?? undefined}
                        onValueChange={(v) => patch({ user_id: u.user_id, plan_code: v }, "Plano alterado")}
                      >
                        <SelectTrigger className="h-8 w-36"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {q.data.plans.map((p) => (
                            <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{fmt(u.created_at)}</TableCell>
                    <TableCell className="text-sm">{fmt(u.activated_at)}</TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        className="h-8 w-36"
                        defaultValue={u.expires_at ? u.expires_at.slice(0, 10) : ""}
                        onBlur={(e) => {
                          const v = e.target.value;
                          const cur = u.expires_at ? u.expires_at.slice(0, 10) : "";
                          if (v === cur) return;
                          patch(
                            { user_id: u.user_id, expires_at: v ? new Date(`${v}T23:59:59`).toISOString() : null },
                            v ? "Data de expiração definida" : "Expiração removida",
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{fmtTime(u.last_seen_at ?? u.last_login_at)}</TableCell>
                    <TableCell className="text-right">
                      {u.effective === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.user_id === me?.id}
                          onClick={() => patch({ user_id: u.user_id, status: "suspended" }, "Usuário suspenso")}
                        >
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-gradient-gold text-[color:var(--primary-foreground)]"
                          onClick={() =>
                            patch(
                              {
                                user_id: u.user_id,
                                status: "active",
                                ...(u.effective === "expired" ? { expires_at: null } : {}),
                                ...(u.access_type === "-" ? { access_type: "beta", plan_code: "beta" } : {}),
                              },
                              "Usuário ativado",
                            )
                          }
                        >
                          Ativar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrantDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState("beta");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-gold text-[color:var(--primary-foreground)]">
          <UserPlus className="mr-2 h-4 w-4" /> Conceder acesso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conceder acesso</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await grantAccessFn({
                data: {
                  name,
                  email,
                  password: password || undefined,
                  access_type: type,
                  expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
                },
              });
              toast.success(r.created ? "Conta criada e acesso liberado" : "Acesso liberado para a conta existente");
              setOpen(false);
              setName(""); setEmail(""); setPassword(""); setExpires("");
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Não foi possível conceder o acesso");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Senha inicial</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Só para contas novas (mín. 12 caracteres)" />
            <p className="text-xs text-muted-foreground">Se o e-mail já tiver conta, a senha atual é mantida.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de acesso</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beta">Beta</SelectItem>
                  <SelectItem value="licensed">Licenciado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Expira em (opcional)</Label><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-[color:var(--primary-foreground)]">
            {busy ? "Salvando…" : "Liberar acesso"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
