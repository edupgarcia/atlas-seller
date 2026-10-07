import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { subDays, addDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { MoneyText } from "@/components/money-text";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSeller } from "@/hooks/use-seller";
import { fetchConsolidated } from "@/lib/queries";
import { hasMarketplaceAccountFn } from "@/lib/queries.functions";
import { brl, num, pct, isoDay } from "@/lib/format";
import { openAmazonAuth } from "@/lib/amazon-oauth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — Atlas Seller" }] }),
  component: DashboardPage,
});

const CHART_COLORS = ["#F59E0B", "#06B6D4", "#8B5CF6", "#10B981", "#EC4899"];

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

// === HELPERS DE SÉRIE DIÁRIA (BRT) ===

type DailyRow = {
  order_purchase_date: string | null;
  item_revenue?: number | null;
  quantity_ordered?: number | null;
  total_fees?: number | null;
};

// Converte um Date para a chave "dd/MM/yyyy" no fuso BRT
function toDayKey(dt: Date): string {
  return dt.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Converte "dd/MM/yyyy" em um Date "âncora" (meio-dia UTC) para iteração segura entre dias
function parseDayKey(key: string): Date {
  const [day, month, year] = key.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

// Gera a série diária completa:
// 1) Sempre em ordem crescente (mais antigo → mais recente)
// 2) Dias sem venda entram com valor 0 (sem "buracos" no gráfico)
// 3) Quando o período selecionado é de 1 dia (ex.: "Hoje"),
//    expande para os últimos 7 dias terminando na data selecionada
function buildDailySeries(
  rows: DailyRow[],
  range: DateRange | undefined,
  valueFn: (r: DailyRow) => number
): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.order_purchase_date ? toDayKey(new Date(r.order_purchase_date)) : null;
    if (!d) continue;
    map.set(d, (map.get(d) ?? 0) + valueFn(r));
  }

  let startKey: string | undefined;
  let endKey: string | undefined;

  if (range?.from && range?.to) {
    const fromKey = toDayKey(range.from);
    const toKey = toDayKey(range.to);
    if (fromKey === toKey) {
      // Período de 1 dia → últimos 7 dias (6 anteriores + o selecionado)
      startKey = toDayKey(subDays(range.to, 6));
      endKey = toKey;
    } else {
      startKey = fromKey;
      endKey = toKey;
    }
  }

  if (startKey && endKey) {
    const out: { date: string; value: number }[] = [];
    let cursor = parseDayKey(startKey);
    const end = parseDayKey(endKey);
    while (cursor.getTime() <= end.getTime()) {
      const key = toDayKey(cursor);
      out.push({ date: key, value: map.get(key) ?? 0 });
      cursor = addDays(cursor, 1);
    }
    return out;
  }

  // Fallback (sem range): apenas dias com dados, ordenados crescentemente
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}

function DashboardPage() {
  const { seller } = useSeller();
  const [activePreset, setActivePreset] = useState<DatePreset>("7d");
  const [range, setRange] = useState<DateRange | undefined>(
    getPresetRange("7d")
  );

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

  const query = useQuery({
    queryKey: [
      "consolidated",
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

  const marketplaceCheck = useQuery({
    queryKey: ["has-marketplace-account"],
    queryFn: () => hasMarketplaceAccountFn(),
  });

  // Depois que o usuário autoriza a conta Amazon numa aba separada, ao voltar
  // para esta aba refazemos a checagem de conexão automaticamente — sem isso
  // o aviso "conta não conectada" podia continuar visível até um reload manual.
  useEffect(() => {
    const onFocus = () => {
      marketplaceCheck.refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [marketplaceCheck]);

  const rows = query.data ?? [];
  // Filtra apenas pedidos com quantidade > 0 (remove cancelados/zerados)
  const validRows = useMemo(
    () => rows.filter((r) => (r.quantity_ordered ?? 0) > 0),
    [rows]
  );

  const kpis = useMemo(() => {
    const sales = validRows.reduce((a, r) => a + (r.item_revenue ?? 0) * (r.quantity_ordered ?? 0), 0);
    const fees = validRows.reduce((a, r) => a + (r.total_fees ?? 0), 0);
    const profit = validRows.reduce((a, r) => a + (r.gross_profit ?? 0), 0);
    const orders = new Set(validRows.map((r) => r.amazon_order_id)).size;
    const avg = orders ? sales / orders : 0;
    const margin = sales ? (profit / sales) * 100 : 0;
    return { sales, fees, netMarketplace: sales + fees, profit, orders, avg, margin };
  }, [validRows]);

  // Faturamento por dia — série completa em ordem crescente;
  // "Hoje" (1 dia) expande para os últimos 7 dias
  const dailyRevenue = useMemo(
    () =>
      buildDailySeries(validRows, range, (r) => (r.item_revenue ?? 0) * (r.quantity_ordered ?? 0)),
    [validRows, range]
  );

  // Líquido do Marketplace por dia — mesma regra de série/ordenação
  const dailyNetMarketplace = useMemo(
    () =>
      buildDailySeries(validRows, range, (r) => (r.item_revenue ?? 0) * (r.quantity_ordered ?? 0) + (r.total_fees ?? 0)),
    [validRows, range]
  );

  // === Donut: Lucro Bruto por Canal (FBA vs DBA) ===
  const byChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of validRows) {
      const raw = (r.order_fulfillment_channel ?? "").toString().trim().toUpperCase();
      const k =
        raw === "AFN" || raw === "FBA" || raw === "AMAZON" || raw === "AMAZON_FBA"
          ? "FBA"
          : raw === "MFN" || raw === "DBA" || raw === "FBM" || raw === "SELLER" || raw === "DEFAULT" || raw === "MFN_FBM"
          ? "DBA"
          : raw === ""
          ? "Sem Canal"
          : "Outros";
      map.set(k, (map.get(k) ?? 0) + (r.gross_profit ?? 0));
    }
    return Array.from(map.entries())
      .filter(([, value]) => value !== 0)
      .map(([name, value]) => ({ name, value }));
  }, [validRows]);

  const channelTotal = byChannel.reduce((a, r) => a + Math.abs(r.value), 0);

  const marketplaces = Array.from(
    new Set(validRows.map((r) => r.sales_channel).filter(Boolean))
  );

  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { sku: string; name: string; qty: number; revenue: number; cost: number; profit: number }
    >();
    for (const r of validRows) {
      const key = r.seller_sku;
      const cur = map.get(key) ?? {
        sku: r.seller_sku,
        name: r.product_name ?? "—",
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      cur.qty += r.quantity_ordered ?? 0;
      cur.revenue += (r.item_revenue ?? 0) * (r.quantity_ordered ?? 0);
      cur.cost += (r.cost_product ?? 0) * (r.quantity_ordered ?? 0);
      cur.profit += r.gross_profit ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [validRows]);

  return (
    <div className="min-h-screen">
      {/* === HEADER COM PRESETS DE DATA === */}
      <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
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
        </div>
        {activePreset === "custom" && (
          <DateRangePicker value={range} onChange={handleRangeChange} />
        )}
        <div className="flex flex-wrap gap-2">
          {marketplaces.length === 0 ? (
            <Badge variant="outline" className="text-muted-foreground">
              Sem marketplaces
            </Badge>
          ) : (
            marketplaces.map((m) => (
              <Badge key={m as string} className="bg-gradient-gold text-[color:var(--primary-foreground)]">
                {m}
              </Badge>
            ))
          )}
        </div>
      </header>
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        {marketplaceCheck.isSuccess && marketplaceCheck.data === false && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[color:var(--warning)]" />
              <span className="text-sm text-foreground">
                Sua conta Amazon ainda não está conectada. Conecte para começar a receber dados.
              </span>
            </div>
            <Button size="sm" className="bg-gradient-gold text-[color:var(--primary-foreground)]" onClick={() => openAmazonAuth().catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão"))}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Conectar conta Amazon
            </Button>
          </div>
        )}
        {/* === KPIs === */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KPICard label="Vendas" value={brl(kpis.sales)} sparkline={dailyRevenue.map((d) => d.value)} />
          <KPICard
            label="Líq. Marketplace"
            value={brl(kpis.netMarketplace)}
            sparkline={dailyNetMarketplace.map((d) => d.value)}
            valueClassName={kpis.netMarketplace < 0 ? "text-destructive" : undefined}
          />
          <KPICard
            label="Lucro Bruto"
            value={brl(kpis.profit)}
            sparkline={dailyRevenue.map((d) => d.value)}
            valueClassName={kpis.margin < 0 ? "text-destructive" : undefined}
          />
          <KPICard label="Margem Bruta" value={pct(kpis.margin)} />
          <KPICard label="Pedidos" value={num(kpis.orders)} />
          <KPICard label="Ticket Médio" value={brl(kpis.avg)} />
        </div>
        {/* === GRÁFICOS === */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Faturamento por Dia */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Faturamento por Dia</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="grevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E293B" strokeOpacity={0.5} />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #1E293B", borderRadius: 8 }}
                    formatter={(v: number) => brl(v)}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fill="url(#grevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {/* Lucro Bruto por Canal */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Lucro Bruto por Canal</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byChannel}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, value, percent }: { name: string; value: number; percent?: number }) => {
                      const p = typeof percent === "number" ? pct(percent * 100) : "0%";
                      return `${name}: ${p}`;
                    }}
                    labelLine={false}
                  >
                    {byChannel.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #1E293B", borderRadius: 8 }}
                    formatter={(v: number, name: string) => {
                      const percent = channelTotal > 0 ? ` (${pct((Math.abs(v) / channelTotal) * 100)})` : "";
                      return [`${brl(v)}${percent}`, name];
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        {/* === TOP 5 PRODUTOS === */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Top 5 Produtos por Lucro Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Produto</th>
                    <th className="py-2 pr-4 text-right font-medium">Qty</th>
                    <th className="py-2 pr-4 text-right font-medium">Receita</th>
                    <th className="py-2 pr-4 text-right font-medium">Custo</th>
                    <th className="py-2 pr-4 text-right font-medium">Lucro</th>
                    <th className="py-3 text-right font-medium">Margem</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {topProducts.map((p) => {
                    const margin = p.revenue ? (p.profit / p.revenue) * 100 : 0;
                    return (
                      <tr key={p.sku} className="border-b border-border/50 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-foreground">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className="py-3 pr-4 text-right">{num(p.qty)}</td>
                        <td className="py-3 pr-4 text-right"><MoneyText value={p.revenue} /></td>
                        <td className="py-3 pr-4 text-right"><MoneyText value={p.cost} /></td>
                        <td className={cn("py-3 pr-4 text-right", margin < 0 ? "text-destructive" : "text-[color:var(--success)]")}>
                          <MoneyText value={p.profit} />
                        </td>
                        <td className="py-3 text-right">{pct(margin)}</td>
                      </tr>
                    );
                  })}
                  {topProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        {query.isLoading ? "Carregando..." : "Sem dados no período."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}