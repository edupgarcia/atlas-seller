import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeltaIndicator({ value, className }: { value: number; className?: string }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular",
        positive ? "text-[color:var(--success)]" : "text-destructive",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}
