import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { MoneyText } from "@/components/money-text";
import { useSeller } from "@/hooks/use-seller";
import { fetchConsolidated } from "@/lib/queries";
import { num, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Produtos — Atlas Seller" }] }),
  component: Page,
});

function Page() {
  const { seller } = useSeller();
  const q = useQuery({
    queryKey: ["produtos", seller?.marketplace_account_id],
    queryFn: () => fetchConsolidated({}),
    enabled: !!seller,
  });

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const products = useMemo(() => {
    const map = new Map<string, {
      sku: string; name: string; category: string; channel: string; qty: number; revenue: number; cost_unit: number; profit: number; cost_status: string;
    }>();
    for (const r of q.data ?? []) {
      const cur = map.get(r.seller_sku) ?? {
        sku: r.seller_sku,
        name: r.product_name ?? "—",
        category: r.order_fulfillment_channel ?? "—",
        channel: r.order_fulfillment_channel ?? "—",
        qty: 0,
        revenue: 0,
        cost_unit: r.cost_product ?? 0,
        profit: 0,
        cost_status: r.cost_status ?? "missing",
      };
      cur.qty += r.quantity_ordered ?? 0;
      cur.revenue += (r.item_revenue ?? 0) * (r.quantity_ordered ?? 0);
      cur.profit += r.gross_profit ?? 0;
      map.set(r.seller_sku, cur);
    }
    return Array.from(map.values());
  }, [q.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (s && !p.sku.toLowerCase().includes(s) && !p.name.toLowerCase().includes(s)) return false;
      if (channel !== "all" && p.channel !== channel) return false;
      if (status !== "all" && (p.cost_status ?? "").toLowerCase() !== status) return false;
      return true;
    });
  }, [products, search, channel, status]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const csv = Papa.unparse(
      filtered.map((p) => ({
        SKU: p.sku,
        Produto: p.name,
        Categoria: p.category,
        Qty: p.qty,
        Receita: p.revenue,
        CustoUnit: p.cost_unit,
        LucroBruto: p.profit,
        Margem: p.revenue ? (p.profit / p.revenue) * 100 : 0,
        Status: p.cost_status,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:mb-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Produtos</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{num(filtered.length)} SKUs</p>
        </div>
        <Button onClick={exportCsv} size="sm" className="shrink-0 bg-gradient-gold text-[color:var(--primary-foreground)]">
          <Download className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Catálogo</CardTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-row">
            <Input
              placeholder="Buscar por SKU ou nome..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full md:w-64"
            />
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="AFN">FBA</SelectItem>
                <SelectItem value="MFN">MFN</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Produto</th>
                  <th className="py-2 pr-4 font-medium">Categoria</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Receita</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo Unit</th>
                  <th className="py-2 pr-4 text-right font-medium">Lucro Bruto</th>
                  <th className="py-2 pr-4 text-right font-medium">Margem</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {pageRows.map((p) => {
                  const negative = p.profit < 0;
                  const margin = p.revenue ? (p.profit / p.revenue) * 100 : 0;
                  return (
                    <tr
                      key={p.sku}
                      className={`border-b border-border/50 last:border-0 ${negative ? "bg-destructive/5" : ""}`}
                    >
                      <td className="py-3 pr-4 font-mono text-xs">{p.sku}</td>
                      <td className="py-3 pr-4">{p.name}</td>
                      <td className="py-3 pr-4">{p.category}</td>
                      <td className="py-3 pr-4 text-right">{num(p.qty)}</td>
                      <td className="py-3 pr-4 text-right"><MoneyText value={p.revenue} /></td>
                      <td className="py-3 pr-4 text-right"><MoneyText value={p.cost_unit} /></td>
                      <td className={`py-3 pr-4 text-right font-medium ${negative ? "text-destructive" : "text-[color:var(--success)]"}`}>
                        <MoneyText value={p.profit} />
                      </td>
                      <td className={`py-3 pr-4 text-right ${negative ? "text-destructive" : ""}`}>{pct(margin)}</td>
                      <td className="py-3"><StatusBadge status={p.cost_status} /></td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {q.isLoading ? "Carregando..." : "Sem produtos."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Página {page + 1} de {Math.ceil(filtered.length / PAGE_SIZE)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
