import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const ok = (status ?? "").toLowerCase() === "ok";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        ok
          ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
          : "bg-destructive/15 text-destructive",
      )}
    >
      {ok ? "OK" : "Missing"}
    </span>
  );
}
