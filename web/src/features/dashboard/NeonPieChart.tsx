import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// PIE_COLORS - will be computed from CSS variables at render time
// Using a function to get theme-aware colors
const getPieColors = (): string[] => {
  const root = getComputedStyle(document.documentElement);
  const neonRed = root.getPropertyValue('--neon-red').trim() || '#ff0033';
  // Convert hex to rgb for rgba
  const r = parseInt(neonRed.slice(1, 3), 16);
  const g = parseInt(neonRed.slice(3, 5), 16);
  const b = parseInt(neonRed.slice(5, 7), 16);
  return [
    `rgba(${r}, ${g}, ${b}, 0.90)`,
    `rgba(${r}, ${g}, ${b}, 0.65)`,
    `rgba(${r}, ${g}, ${b}, 0.45)`,
    `rgba(${r}, ${g}, ${b}, 0.30)`,
    `rgba(${r}, ${g}, ${b}, 0.18)`,
  ];
};

export default function NeonPieChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-white/60 text-sm p-4">
        No lead source data available
      </div>
    );
  }

  // Calculate total for fallback percentage calculation
  const total = data.reduce((sum, entry) => sum + (entry.value || 0), 0);
  
  // Get theme-aware pie colors
  const PIE_COLORS = getPieColors();

  // Custom label renderer - shows only percentage
  const renderLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,   // <- Recharts' percent (0–1) - ALWAYS use this for consistency
    payload,
  }: any) => {
    if (!payload || payload.value === 0) return null;

    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 12;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // ALWAYS calculate from Recharts' percent parameter (0-1) OR from value/total
    // Never use any pre-computed percent property from the data
    // Recharts' percent is always 0-1, so we multiply by 100 to get 0-100
    let pct: number;
    if (typeof percent === "number" && !isNaN(percent) && percent >= 0 && percent <= 1) {
      // Recharts' percent is always 0-1, multiply by 100
      pct = Math.round(percent * 100);
    } else if (total > 0 && payload.value) {
      // Fallback: calculate percentage from value/total
      pct = Math.round((payload.value / total) * 100);
    } else {
      pct = 0;
    }

    return (
      <text
        x={x}
        y={y}
        fill="var(--text-primary)"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        style={{
          fontSize: "12px",
          filter: "drop-shadow(0 0 4px var(--neon-red-glow))",
        }}
      >
        {`${pct}%`}
      </text>
    );
  };

  // Neon glass tooltip - fixes the black box blocking text
  const renderNeonTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const first = payload[0];
    const { name, value } = first;

    // Always use Recharts' built-in percent (0-1) from the payload
    // Never use any pre-computed percent property from the data
    let pct: number;
    if (typeof first.percent === "number" && !isNaN(first.percent) && first.percent >= 0 && first.percent <= 1) {
      // Recharts' percent is always 0-1, multiply by 100
      pct = Math.round(first.percent * 100);
    } else {
      // Fallback: calculate from value/total
      pct = total > 0 && value ? Math.round((value / total) * 100) : 0;
    }

    const root = getComputedStyle(document.documentElement);
    const glassBg = root.getPropertyValue('--glass-bg').trim();
    const glassBorder = root.getPropertyValue('--glass-border').trim();
    const neonRedDim = root.getPropertyValue('--neon-red-dim').trim();
    
    return (
      <div
        className="px-3 py-2 rounded-lg text-xs"
        style={{
          background: glassBg,
          border: `1px solid ${glassBorder}`,
          boxShadow: `0 0 12px ${neonRedDim}`,
          backdropFilter: "blur(6px)",
          pointerEvents: "none",
          color: "var(--text-primary)",
        }}
      >
        <div className="font-medium">{name}</div>
        <div className="opacity-80">
          {value} leads ({pct}%)
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          stroke="var(--glass-border)"
          strokeWidth={2}
          labelLine={false}
          label={renderLabel}
        >
          {data.map((entry, index) => (
            <Cell
              key={`slice-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
              style={{
                filter: "drop-shadow(0px 0px 6px var(--neon-red-dim))",
                transition: "all 0.2s ease-out",
              }}
              onMouseOver={(e) => {
                const target = e.target as SVGPathElement;
                if (target) {
                  const root = getComputedStyle(document.documentElement);
                  const glow = root.getPropertyValue('--neon-red-glow').trim();
                  target.style.filter = `drop-shadow(0px 0px 12px ${glow})`;
                  target.style.transform = "scale(1.03)";
                }
              }}
              onMouseOut={(e) => {
                const target = e.target as SVGPathElement;
                if (target) {
                  target.style.filter = "drop-shadow(0px 0px 6px var(--neon-red-dim))";
                  target.style.transform = "scale(1)";
                }
              }}
            />
          ))}
        </Pie>

        <Tooltip
          wrapperStyle={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
          }}
          content={renderNeonTooltip}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
