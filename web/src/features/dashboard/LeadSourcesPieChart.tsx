import React from "react";
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface SourceItem {
  label: string;
  count: number;
  color?: string;
}

interface Props {
  sources: SourceItem[];
}

export default function LeadSourcesPieChart({ sources }: Props) {
  const LABEL_MAP: Record<string, string> = {
    cold_call: "Cold Call",
    sms: "SMS",
    ppc: "PPC",
    driving_for_dollars: "Driving for Dollars",
    referral: "Referral",
    other: "Other",
  };

  // Total leads for percentage calculation
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  // Prepare data with labels + percentages
  const data = sources.map((s) => {
    const pct = total === 0 ? 0 : Math.round((s.count / total) * 100);

    return {
      name: LABEL_MAP[s.label] || s.label || "Other",   // FIXED
      value: s.count,
      percentage: pct,
      label: `${pct}%`,
      color: s.color || "#ff0033",
    };
  });

  // Neon custom label renderer (OUTSIDE the ring)
  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,   // <- Recharts' percent (0–1) - ALWAYS use this
    payload,
  }: any) => {
    if (payload?.value === 0) return null;

    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 12;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Always calculate from Recharts' percent (0-1) to avoid using pre-computed values
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
        className="text-xs"
        style={{ filter: "drop-shadow(0 0 6px var(--neon-red-glow))" }}
      >
        {`${pct}%`}
      </text>
    );
  };

  // Neon glass tooltip — fixes the black box blocking text
  const renderNeonTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const { name, value, payload: p } = payload[0];

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
          {value} leads ({p.percentage}%)
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            paddingAngle={3}
            labelLine={false}
            label={renderLabel}
            isAnimationActive={true}
          >
            {data.map((slice, i) => (
              <Cell
                key={i}
              fill={slice.color}
              stroke="var(--glass-border)"
              strokeWidth={1}
              />
            ))}
          </Pie>

          <Tooltip content={renderNeonTooltip} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

