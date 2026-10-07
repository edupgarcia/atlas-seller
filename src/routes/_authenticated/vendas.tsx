import { useMemo, useState } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { DateRange } from "react-day-picker";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { Download, RotateCcw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/components/money-text";
import { useSeller } from "@/hooks/use-seller";
import { fetchConsolidated } from "@/lib/queries";
import { reprocessCostsFn } from "@/lib/queries.functions";
import { num, pct, isoDay, brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Vendas — Atlas Seller" }] }),
  component: VendasPage,
});

// === PRESETS DE DATA ===
type DatePreset = "today" | "7d" | "15d" | "thisMonth" | "lastMonth" | "custom";
const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "15d": "Últimos 15 dias",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  custom: "Personalizado",
};

function getPresetRange(preset: DatePreset): DateRange | undefined {
  const now = new Date();
  // Converte o "now" para BRT (America/Sao_Paulo) para calcular os limites
  const nowBRT = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  switch (preset) {
    case "today":
      return { from: startOfDay(nowBRT), to: endOfDay(nowBRT) };
    case "7d":
      return { from: startOfDay(subDays(nowBRT, 6)), to: endOfDay(nowBRT) };
    case "15d":
      return { from: startOfDay(subDays(nowBRT, 14)), to: endOfDay(nowBRT) };
    case "thisMonth":
      return { from: startOfDay(startOfMonth(nowBRT)), to: endOfDay(nowBRT) };
    case "lastMonth": {
      const last = subMonths(nowBRT, 1);
      return { from: startOfDay(startOfMonth(last)), to: endOfDay(endOfMonth(last)) };
    }
    case "custom":
    default:
      return undefined;
  }
}

function VendasPage() {
  const { seller } = useSeller();
  const queryClient = useQueryClient();
  const [activePreset, setActivePreset] = useState<DatePreset>("7d");
  const [range, setRange] = useState<DateRange | undefined>(getPresetRange("7d"));

  // Estado do modal de reprocessamento
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [reprocessSku, setReprocessSku] = useState("");
  const [reprocessFrom, setReprocessFrom] = useState("");
  const [reprocessTo, setReprocessTo] = useState("");
  const [reprocessing, setReprocessing] = useState(false);

  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      setRange(getPresetRange(preset));
    }
  };

  const handleRangeChange = (newRange: DateRange | undefined) => {
    setActivePreset("custom");
    setRange(newRange);
  };

  const q = useQuery({
    queryKey: [
      "vendas",
      seller?.marketplace_account_id,
      isoDay(range?.from?.toISOString()),
      isoDay(range?.to?.toISOString()),
    ],
    queryFn: () =>
      fetchConsolidated({
        from: range?.from?.toISOString(),
        to: range?.to?.toISOString(),
      }),
    enabled: !!seller,
  });

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Lista de pedidos
  const orders = useMemo(() => {
    return (q.data ?? [])
      .filter((r) => (r.quantity_ordered ?? 0) > 0)
      .map((r) => ({
        order_id: r.amazon_order_id ?? "—",
        date: r.order_purchase_date ? isoDay(r.order_purchase_date) : "—",
        sku: r.seller_sku,
        name: r.product_name ?? "—",
        channel: r.order_fulfillment_channel ?? "—",
        qty: r.quantity_ordered ?? 0,
        revenue: r.principal ?? 0,
        cost_unit: r.cost_product ?? 0,
        cost_total: (r.cost_product ?? 0) * (r.quantity_ordered ?? 0),
        fees: r.total_fees ?? 0,
        profit: r.gross_profit ?? 0,
        margin: (r.principal ?? 0) > 0
          ? ((r.gross_profit ?? 0) / (r.principal ?? 0)) * 100
          : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [q.data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (s && !o.order_id.toLowerCase().includes(s) && !o.sku.toLowerCase().includes(s) && !o.name.toLowerCase().includes(s)) return false;
      if (channel !== "all" && o.channel !== channel) return false;
      return true;
    });
  }, [orders, search, channel]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const csv = Papa.unparse(
      filtered.map((o) => ({
        Pedido: o.order_id,
        Data: o.date,
        SKU: o.sku,
        Produto: o.name,
        Canal: o.channel === "AFN" ? "FBA" : o.channel === "MFN" ? "DBA" : o.channel,
        Qty: o.qty,
        Receita: o.revenue,
        Tarifas: o.fees,
        CustoTotal: o.cost_total,
        LucroBruto: o.profit,
        Margem: o.margin,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 🔄 Reprocessamento de custos
const handleReprocess = async () => {
  if (!reprocessSku.trim()) {
    toast.error("Informe o SKU para reprocessar");
    return;
  }
  if (!reprocessFrom || !reprocessTo) {
    toast.error("Informe o período para reprocessar");
    return;
  }
  setReprocessing(true);
  try {
    const fromDate = new Date(`${reprocessFrom}T00:00:00-03:00`);
    const toDate = new Date(`${reprocessTo}T23:59:59-03:00`);
    await reprocessCostsFn({
      data: {
        sku: reprocessSku.trim().toUpperCase(),
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
    });
    toast.success("Reprocessamento concluído!");
    setReprocessOpen(false);
    setReprocessSku("");
    setReprocessFrom("");
    setReprocessTo("");
    queryClient.invalidateQueries({ queryKey: ["vendas"] });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro no reprocessamento";
    toast.error(msg);
  } finally {
    setReprocessing(false);
  }
};

  return (
    <div className="min-h-screen p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:mb-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Vendas</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{num(filtered.length)} pedidos</p>
        </div>
        <div className="flex gap-2">
          {/* 🔄 Botão Reprocessar */}
          <Dialog open={reprocessOpen} onOpenChange={setReprocessOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <RotateCcw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reprocessar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reprocessar custos</DialogTitle>
                <DialogDescription>
                  Atualiza o custo dos pedidos no período para o SKU informado,
                  usando o valor atual cadastrado no produto.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="reprocess-sku">SKU</Label>
                  <Input
                    id="reprocess-sku"
                    placeholder="Ex: DEFCOZ-09"
                    value={reprocessSku}
                    onChange={(e) => setReprocessSku(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="reprocess-from">Data inicial</Label>
                    <Input
                      id="reprocess-from"
                      type="date"
                      value={reprocessFrom}
                      onChange={(e) => setReprocessFrom(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reprocess-to">Data final</Label>
                    <Input
                      id="reprocess-to"
                      type="date"
                      value={reprocessTo}
                      onChange={(e) => setReprocessTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReprocessOpen(false)} disabled={reprocessing}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleReprocess}
                  disabled={reprocessing}
                  className="bg-gradient-gold font-semibold text-[color:var(--primary-foreground)]"
                >
                  {reprocessing ? "Reprocessando..." : "Reprocessar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={exportCsv} size="sm" className="shrink-0 bg-gradient-gold text-[color:var(--primary-foreground)]">
            <Download className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>
      {/* Filtros de data */}
      <div className="-mx-1 mb-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        {Object.entries(PRESET_LABELS).map(([key, label]) => {
          const preset = key as DatePreset;
          const isActive = activePreset === preset;
          return (
            <button
              key={key}
              onClick={() => handlePresetChange(preset)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          );
        })}
        {activePreset === "custom" && (
          <DateRangePicker value={range} onChange={handleRangeChange} />
        )}
      </div>
      {/* Tabela */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">Pedidos</CardTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] md:flex md:flex-row">
            <Input
              placeholder="Buscar por pedido, SKU ou nome..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full md:w-72"
            />
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(0); }}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="AFN">FBA</SelectItem>
                <SelectItem value="MFN">DBA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Pedido</th>
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">SKU</th>
                  <th className="py-2 pr-4 font-medium">Produto</th>
                  <th className="py-2 pr-4 font-medium">Canal</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Receita</th>
                  <th className="py-2 pr-4 text-right font-medium">Tarifas</th>
                  <th className="py-2 pr-4 text-right font-medium">Custo</th>
                  <th className="py-2 pr-4 text-right font-medium">Lucro</th>
                  <th className="py-2 pr-4 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {pageRows.map((o, i) => (
                  <tr key={`${o.order_id}-${o.sku}-${i}`} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">{o.order_id}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{o.date}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{o.sku}</td>
                    <td className="py-3 pr-4 max-w-xs truncate" title={o.name}>{o.name}</td>
                    <td className="py-3 pr-4 text-xs">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        o.channel === "AFN" ? "bg-amber-500/15 text-amber-400" : "bg-cyan-500/15 text-cyan-400"
                      )}>
                        {o.channel === "AFN" ? "FBA" : "DBA"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{num(o.qty)}</td>
                    <td className="py-3 pr-4 text-right"><MoneyText value={o.revenue} /></td>
                    <td className="py-3 pr-4 text-right text-muted-foreground"><MoneyText value={o.fees} /></td>
                    <td className="py-3 pr-4 text-right text-muted-foreground"><MoneyText value={o.cost_total} /></td>
                    <td className={cn("py-3 pr-4 text-right", o.margin < 0 ? "text-destructive" : "text-[color:var(--success)]")}>
                      <MoneyText value={o.profit} />
                    </td>
                    <td className={cn("py-3 pr-4 text-right text-xs", o.margin < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {pct(o.margin)}
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                    {q.isLoading ? "Carregando..." : "Sem pedidos no período."}
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