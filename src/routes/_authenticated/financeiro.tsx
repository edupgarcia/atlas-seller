import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
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
import { dateBR, isoDay, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Financeiro — Atlas Seller" }] }),
  component: Page,
});

function Page() {
  const { seller } = useSeller();
  const [range, setRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  const [sku, setSku] = useState("");
  const [marketplace, setMarketplace] = useState("all");

  const q = useQuery({
    queryKey: ["fin", seller?.marketplace_account_id, isoDay(range?.from?.toISOString()), isoDay(range?.to?.toISOString())],
    queryFn: () => fetchConsolidated({
      from: range?.from?.toISOString(),
      to: range?.to?.toISOString(),
    }),
    enabled: !!seller,
  });

  const rows = q.data ?? [];
  const marketplaces = Array.from(new Set(rows.map((r) => r.sales_channel).filter(Boolean))) as string[];

  const filtered = useMemo(() => {
    const s = sku.trim().toLowerCase();
    return rows.filter((r) => {
      if (s && !r.seller_sku.toLowerCase().includes(s)) return false;
      if (marketplace !== "all" && r.sales_channel !== marketplace) return false;
      return true;
    });
  }, [rows, sku, marketplace]);

  const totals = filtered.reduce(
    (a, r) => ({ net: a.net + (r.net_revenue ?? 0), gp: a.gp + (r.gross_profit ?? 0) }),
    { net: 0, gp: 0 },
  );

  const cols: [string, keyof typeof filtered[number]][] = [
    ["Pedido", "amazon_order_id"],
    ["SKU", "seller_sku"],
    ["Produto", "product_name"],
    ["Data", "order_purchase_date"],
    ["Qty", "quantity_ordered"],
    ["Preço item", "item_price_amount"],
    ["Desconto", "promotion_discount"],
    ["Principal", "principal"],
    ["Frete", "shipping_charge"],
    ["Imposto", "tax"],
    ["FBA Fee", "fba_fee"],
    ["Comissão", "commission"],
    ["Total Fees", "total_fees"],
    ["MFN Postage", "mfn_postage_fee"],
    ["Serviços", "total_service_fees"],
    ["Net Revenue", "net_revenue"],
    ["Custo", "cost_product"],
    ["Lucro Bruto", "gross_profit"],
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Financeiro</h1>
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

      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-base">Movimentações ({num(filtered.length)})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left uppercase tracking-wide text-muted-foreground">
                  {cols.map(([label]) => (
                    <th key={label} className="whitespace-nowrap py-2 pr-3 font-medium">{label}</th>
                  ))}
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {filtered.map((r, i) => {
                  const missing = (r.cost_status ?? "").toLowerCase() === "missing";
                  return (
                    <tr
                      key={`${r.amazon_order_id}-${r.order_item_id ?? i}`}
                      className={cn(
                        "border-b border-border/40 last:border-0",
                        missing && "bg-[color:var(--warning)]/10",
                      )}
                    >
                      {cols.map(([, key]) => {
                        const v = r[key];
                        if (key === "order_purchase_date" || key === "posted_date")
                          return <td key={key} className="whitespace-nowrap py-2 pr-3">{dateBR(v as string)}</td>;
                        if (typeof v === "number")
                          return <td key={key} className="whitespace-nowrap py-2 pr-3 text-right"><MoneyText value={v} /></td>;
                        return <td key={key} className="whitespace-nowrap py-2 pr-3">{v ?? "-"}</td>;
                      })}
                      <td className="py-2 pr-3">{r.cost_status ?? "-"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="py-8 text-center text-muted-foreground">
                    {q.isLoading ? "Carregando..." : "Sem dados."}
                  </td></tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={cols.length - 3} className="py-3 pr-3 text-right">Totais:</td>
                    <td className="py-3 pr-3 text-right"><MoneyText value={totals.net} /></td>
                    <td className="py-3 pr-3" />
                    <td className="py-3 pr-3 text-right text-[color:var(--success)]"><MoneyText value={totals.gp} /></td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
