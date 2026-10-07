import { Card, CardContent } from "@/components/ui/card";
import { DeltaIndicator } from "./delta-indicator";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function KPICard({
  label,
  value,
  delta,
  sparkline,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  delta?: number;
  sparkline?: number[];
  className?: string;
  valueClassName?: string;
}) {
  const data = (sparkline ?? []).map((v, i) => ({ i, v }));
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-2 text-2xl font-bold tabular text-foreground", valueClassName)}>{value}</p>
            {typeof delta === "number" && <DeltaIndicator value={delta} className="mt-1" />}
          </div>
          {data.length > 1 && (
            <div className="h-10 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
