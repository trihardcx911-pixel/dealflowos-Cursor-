import React from "react";
import {
  LineChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface NeonLineChartProps {
  title: string;
  data: Array<{ date: string; value: number }>;
  range: "week" | "month" | "year";
  setRange: (r: "week" | "month" | "year") => void;
}

export default function NeonLineChart({ title, data, range, setRange }: NeonLineChartProps) {
  // ─────────────────────────────────────────
  //  ZERO-VALUE PATCH
  //  If dataset exists but all values are 0,
  //  we inject two synthetic points so the chart
  //  renders a soft flat neon line instead of empty space.
  // ─────────────────────────────────────────
  let safeData = [...data];
  
  const allZero = safeData.length > 0 && safeData.every((d) => d.value === 0);
  
  if (allZero) {
    const first = safeData[0];
    const last = safeData[safeData.length - 1];
    
    // Two flat points so Recharts draws a line
    safeData = [
      { date: first.date, value: 0 },
      { date: last.date, value: 0 }
    ];
  }

  return (
    <div className="neon-line-card">

      <h3 className="chart-title">{title}</h3>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={260}>
          {/* use safeData instead of raw data */}
          <LineChart data={safeData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid
              stroke="var(--glass-border)"
              strokeDasharray="4 4"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[0, 'auto']}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{ stroke: "var(--neon-red-soft)", strokeWidth: 2 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                return (
                  <div className="neon-tooltip">
                    <p className="tooltip-value">{payload[0].value}</p>
                    <p className="tooltip-date">{payload[0].payload.date}</p>
                  </div>
                );
              }}
            />

            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--neon-red)"
              strokeWidth={3}
              dot={{
                r: 5,
                stroke: "var(--neon-red)",
                strokeWidth: 2,
                fill: "var(--bg-base)",
              }}
              activeDot={{
                r: 7,
                fill: "var(--neon-red)",
                stroke: "var(--text-primary)",
                strokeWidth: 1.5,
              }}
            />

          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TIMEFRAME TOGGLE — NOW CENTERED BELOW THE CHART */}
      <div className="timeframe-toggle centered">
        {["week", "month", "year"].map((tf) => (
          <button
            key={tf}
            onClick={() => setRange(tf as any)}
            className={`tf-btn ${range === tf ? "active" : ""}`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
