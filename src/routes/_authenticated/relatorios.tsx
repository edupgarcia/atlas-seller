import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/relatorios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatórios — Atlas Seller" }] }),
  component: () => (
    <div className="p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Relatórios</h1>
      <Card className="border-border bg-card"><CardContent className="p-6 text-sm text-muted-foreground sm:p-8">
        Relatórios personalizados chegarão em breve. Use "Exportar CSV" na página de Produtos.
      </CardContent></Card>
    </div>
  ),
});
