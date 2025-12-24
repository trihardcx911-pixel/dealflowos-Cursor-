import React, { useMemo } from "react";

interface NeonVelocityGaugeProps {
  score: number; // 0–100 scaled performance score
}

export default function NeonVelocityGauge({ score }: NeonVelocityGaugeProps) {
  // ────────────────────────────────────────────────
  // 1. Clamp score + dynamic neon color logic
  // ────────────────────────────────────────────────
  const pct = Math.max(0, Math.min(100, score));

  const arcColor = useMemo(() => {
    if (pct < 35) return "rgba(255,40,40,1)";    // red
    if (pct < 65) return "rgba(255,85,60,1)";    // orange-red
    return "rgba(80,255,120,1)";                 // neon green
  }, [pct]);

  // Convert percent → arc angle (200° to 340° = 140° sweep)
  const startAngle = 200;
  const endAngle = 340;
  const sweep = endAngle - startAngle;

  // Needle motion easing
  const angle = useMemo(() => {
    return startAngle + (pct / 100) * sweep;
  }, [pct]);

  // Arc geometry
  const radius = 110;
  const cx = 150;
  const cy = 150;

  // Convert an angle in degrees → x,y coordinate
  const polarToXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const start = polarToXY(startAngle);
  const end = polarToXY(endAngle);

  // Needle endpoint (slightly longer so it visually pops)
  const needle = polarToXY(angle);

  return (
    <div className="velocity-gauge-card neon-glass velocity-hover-pulse">
      <h4 className="gauge-title">Deal Velocity</h4>

      <svg width="300" height="200" className="velocity-gauge-svg">

        {/* Background Arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`}
          stroke="var(--glass-border)"
          strokeWidth="12"
          fill="none"
        />

        {/* NEON Active Arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${needle.x} ${needle.y}`}
          stroke={arcColor}
          strokeWidth="12"
          fill="none"
          style={{
            filter: `drop-shadow(0 0 12px ${arcColor})`,
            transition: "stroke 0.4s ease-out, filter 0.4s ease-out",
          }}
        />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke="var(--text-primary)"
          strokeWidth="3"
          style={{
            filter: "drop-shadow(0 0 10px var(--text-primary))",
          }}
        />

        {/* Needle center cap */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="var(--text-primary)"
          style={{
            filter: "drop-shadow(0 0 8px var(--text-primary))",
            animation: "pulseGlow 2.4s ease-in-out infinite",
          }}
        />

      </svg>

      {/* Score with micro-trend indicator */}
      <div className="velocity-score-display">
        <span className="velocity-score-number">{pct}%</span>
        <span className="velocity-score-label">Velocity</span>
      </div>
    </div>
  );
}

