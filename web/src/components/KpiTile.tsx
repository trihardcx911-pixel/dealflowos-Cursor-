interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
  isLoading?: boolean;
}

export function KpiTile({ label, value, delta, tone, isLoading }: KpiTileProps) {
  // Force neutral if value is "—" or loading, regardless of tone
  const effectiveTone = (value === "—" || isLoading) ? "neutral" : (tone ?? "neutral");
  
  // Map tone to color class
  const valueColorClass =
    effectiveTone === "positive" ? "text-[#10b981]" :
    effectiveTone === "negative" ? "text-[#ff0a45]" :
    "text-white/80"; // neutral

  return (
    <div className="h-full min-h-0 p-dfos-4 rounded-dfos-xl border border-dfos-sm border-white/10 bg-white/5 flex flex-col">
      <span className="text-xs text-white/60 truncate">{label}</span>
      <div className="mt-auto flex items-end justify-between">
        <span className={`text-2xl font-bold ${valueColorClass} leading-none truncate tabular-nums`}>
          {isLoading ? '—' : value}
        </span>
        {delta && (
          <span className="text-xs text-white/40 ml-auto">{delta}</span>
        )}
      </div>
    </div>
  );
}

