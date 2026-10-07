import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { addDays, subDays } from "date-fns";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/date-range-picker";
import { MoneyText } from "@/components/money-text";
import { useSeller } from "@/hooks/use-seller";
import { fetchConsolidated } from "@/lib/queries";
import { isoDay, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financeiro-gerencial")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fluxo de recebimento — Atlas Seller" }] }),
  component: Page,
});

// Premissa: pedido sem posted_date é pago 25 dias após a data do pedido
const ESTIMATE_LAG_DAYS = 25;
// Pedidos antigos podem ter posted_date dentro do período, então busca-se uma janela maior
const LOOKBACK_DAYS = 60;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "2026-09-25" -> "25/09"
const dayShort = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const dayFull = (d: string) => d.split("-").reverse().join("/");

type DateFields = {
  posted_date?: string | null;
  order_purchase_date?: string | null;
};

// Data efetiva do recebimento: posted_date real, ou data do pedido + 25 dias
function effectiveDay(r: DateFields): { day: string; estimated: boolean } | null {
  if (r.posted_date) {
    const d = isoDay(r.posted_date);
    if (d) return { day: d, estimated: false };
  }
  if (!r.order_purchase_date) return null;
  const d = isoDay(addDays(new Date(r.order_purchase_date), ESTIMATE_LAG_DAYS).toISOString());
  return d ? { day: d, estimated: true } : null;
}

type DayAgg = {
  orders: Set<string>;
  principal: number;
  confirmed: number;
  estimated: number;
};

function Page() {
  const { seller } = useSeller();
  const [range, setRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  const [sku, setSku] = useState("");
  const [marketplace, setMarketplace] = useState("all");

  const q = useQuery({
    queryKey: ["fin-ger", seller?.marketplace_account_id, isoDay(range?.from?.toISOString()), isoDay(range?.to?.toISOString())],
    queryFn: () => fetchConsolidated({
      from: range?.from ? subDays(range.from, LOOKBACK_DAYS).toISOString() : undefined,
      to: range?.to?.toISOString(),
    }),
    enabled: !!seller,
  });

  const rows = q.data ?? [];
  const marketplaces = Array.from(new Set(rows.map((r) => r.sales_channel).filter(Boolean))) as string[];

  // Aplica SKU/marketplace, calcula a data efetiva e filtra pelo período escolhido
  const inRange = useMemo(() => {
    const s = sku.trim().toLowerCase();
    const fromKey = range?.from ? isoDay(range.from.toISOString()) : "";
    const toKey = range?.to ? isoDay(range.to.toISOString()) : "";
    const out: { row: (typeof rows)[number]; day: string; estimated: boolean }[] = [];
    for (const r of rows) {
      if (s && !r.seller_sku.toLowerCase().includes(s)) continue;
      if (marketplace !== "all" && r.sales_channel !== marketplace) continue;
      const eff = effectiveDay(r as DateFields);
      if (!eff) continue;
      if (fromKey && eff.day < fromKey) continue;
      if (toKey && eff.day > toKey) continue;
      out.push({ row: r, day: eff.day, estimated: eff.estimated });
    }
    return out;
  }, [rows, sku, marketplace, range]);

  const daily = useMemo(() => {
    const map = new Map<string, DayAgg>();
    for (const { row: r, day, estimated } of inRange) {
      const d = map.get(day) ?? { orders: new Set<string>(), principal: 0, confirmed: 0, estimated: 0 };
      d.orders.add(r.amazon_order_id);
      d.principal += r.principal ?? 0;
      if (estimated) d.estimated += r.net_revenue ?? 0;
      else d.confirmed += r.net_revenue ?? 0;
      map.set(day, d);
    }
    let acc = 0;
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => {
        const net = d.confirmed + d.estimated;
        acc += net;
        return {
          day,
          label: dayShort(day),
          orders: d.orders.size,
          principal: d.principal,
          deductions: net - d.principal, // negativo = taxas e descontos
          confirmed: d.confirmed,
          estimated: d.estimated,
          net,
          acc,
        };
      });
  }, [inRange]);

  const byChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const { row: r } of inRange) {
      const k = r.sales_channel ?? "Sem marketplace";
      map.set(k, (map.get(k) ?? 0) + (r.net_revenue ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [inRange]);

  const totalNet = daily.reduce((a, d) => a + d.net, 0);
  const totalConfirmed = daily.reduce((a, d) => a + d.confirmed, 0);
  const totalEstimated = daily.reduce((a, d) => a + d.estimated, 0);
  const totalPrincipal = daily.reduce((a, d) => a + d.principal, 0);
  const totalDeductions = totalNet - totalPrincipal;
  const deductionPct = totalPrincipal ? Math.abs(totalDeductions / totalPrincipal) * 100 : 0;
  const totalOrders = new Set(inRange.map((x) => x.row.amazon_order_id)).size;
  const avgDay = daily.length ? totalNet / daily.length : 0;
  const bestDay = daily.reduce<(typeof daily)[number] | null>((b, d) => (!b || d.net > b.net ? d : b), null);
  const maxChannel = byChannel[0]?.[1] || 1;

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Fluxo de recebimento</h1>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
        <DateRangePicker value={range} onChange={setRange} />
        <Input placeholder="Filtrar SKU..." value={sku} onChange={(e) => setSku(e.target.value)} className="w-full md:w-56" />
        <Select value={marketplace} onValueChange={setMarketplace}>
          <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Marketplace" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os marketplaces</SelectItem>
            {marketplaces.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destaque: valor a receber */}
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">A receber no período</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[color:var(--success)] sm:text-4xl">
              {brl(totalNet)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {brl(totalConfirmed)} confirmado · {brl(totalEstimated)} estimado
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {num(totalOrders)} pedidos · {num(daily.length)} dias com recebimento
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Vendas brutas</p>
            <p className="mt-1 text-xl font-semibold tabular-nums"><MoneyText value={totalPrincipal} /></p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Taxas e descontos</p>
            <p className="mt-1 text-xl font-semibold tabular-nums"><MoneyText value={totalDeductions} /></p>
            <p className="mt-1 text-xs text-muted-foreground">{deductionPct.toFixed(1).replace(".", ",")}% da venda bruta</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Média por dia</p>
            <p className="mt-1 text-xl font-semibold tabular-nums"><MoneyText value={avgDay} /></p>
            {bestDay && (
              <p className="mt-1 text-xs text-muted-foreground">
                Melhor dia: {dayFull(bestDay.day)} ({brl(bestDay.net)})
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico: líquido por data de recebimento + acumulado */}
      <Card className="mb-4 border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Recebimento por dia e acumulado</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pedidos sem data de pagamento aparecem como estimado: data do pedido + {ESTIMATE_LAG_DAYS} dias.
          </p>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {q.isLoading ? "Carregando..." : "Nenhum recebimento no período. Ajuste as datas ou os filtros."}
            </p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="day"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) => `R$ ${Math.round(v)}`}
                  />
                  <YAxis yAxisId="acc" orientation="right" hide />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.day ? dayFull(p[0].payload.day) : "")}
                    formatter={(v: number, name: string) => [brl(v), name]}
                  />
                  <Bar yAxisId="day" stackId="net" dataKey="confirmed" name="Confirmado" fill="var(--primary)" />
                  <Bar
                    yAxisId="day"
                    stackId="net"
                    dataKey="estimated"
                    name="Estimado"
                    fill="var(--primary)"
                    fillOpacity={0.4}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="acc"
                    dataKey="acc"
                    name="Acumulado"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={false}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Resumo por data */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Resumo por data de recebimento</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 text-right font-medium">Pedidos</th>
                    <th className="py-2 pr-3 text-right font-medium">Venda bruta</th>
                    <th className="py-2 pr-3 text-right font-medium">Taxas</th>
                    <th className="py-2 pr-3 text-right font-medium">Estimado</th>
                    <th className="py-2 pr-3 text-right font-medium">Líquido</th>
                    <th className="py-2 text-right font-medium">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {[...daily].reverse().map((d) => (
                    <tr key={d.day} className="border-b border-border/40 last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3">{dayFull(d.day)}</td>
                      <td className="py-2 pr-3 text-right">{num(d.orders)}</td>
                      <td className="py-2 pr-3 text-right"><MoneyText value={d.principal} /></td>
                      <td className="py-2 pr-3 text-right"><MoneyText value={d.deductions} /></td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">
                        {d.estimated ? <MoneyText value={d.estimated} /> : "-"}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium"><MoneyText value={d.net} /></td>
                      <td className="py-2 text-right"><MoneyText value={d.acc} /></td>
                    </tr>
                  ))}
                  {daily.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Sem dados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Por marketplace */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-base">Líquido por marketplace</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {byChannel.map(([name, value]) => (
              <div key={name}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span>{name}</span>
                  <span className="tabular-nums font-medium"><MoneyText value={value} /></span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-[color:var(--primary)]"
                    style={{ width: `${Math.max(2, (value / maxChannel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {byChannel.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
