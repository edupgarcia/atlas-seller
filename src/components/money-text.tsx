import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";

export function MoneyText({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  return <span className={cn("tabular", className)}>{brl(value)}</span>;
}
