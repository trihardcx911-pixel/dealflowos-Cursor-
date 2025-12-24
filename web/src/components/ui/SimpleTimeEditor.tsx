import React, { useState, useEffect, useRef } from "react";

interface SimpleTimeEditorProps {
  value: string; // "HH:mm" in 24h format
  onChange: (value: string) => void;
  label?: string;
}

export const SimpleTimeEditor: React.FC<SimpleTimeEditorProps> = ({
  value,
  onChange,
  label,
}) => {
  // Parse incoming 24h value
  const parse24h = (val: string) => {
    const [h, m] = val.split(":").map(Number);
    const hour24 = Math.max(0, Math.min(23, h || 0));
    const minute = Math.max(0, Math.min(59, m || 0));
    
    // Convert to 12h
    const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    
    return { hour12, minute, period };
  };

  const { hour12, minute, period } = parse24h(value);
  
  const [hourInput, setHourInput] = useState(String(hour12));
  const [minuteInput, setMinuteInput] = useState(String(minute).padStart(2, "0"));
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(period);

  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  // Sync with external value changes
  useEffect(() => {
    const { hour12: h, minute: m, period: p } = parse24h(value);
    setHourInput(String(h));
    setMinuteInput(String(m).padStart(2, "0"));
    setSelectedPeriod(p);
  }, [value]);

  // Convert 12h to 24h and emit
  const emitTime = (h12: number, min: number, per: "AM" | "PM") => {
    let hour24: number;
    if (per === "AM") {
      hour24 = h12 === 12 ? 0 : h12;
    } else {
      hour24 = h12 === 12 ? 12 : h12 + 12;
    }
    
    const formatted = `${String(hour24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    onChange(formatted);
  };

  const handleHourChange = (val: string) => {
    setHourInput(val);
    
    if (val === "") return;
    
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    
    const clamped = Math.max(1, Math.min(12, num));
    const min = parseInt(minuteInput, 10) || 0;
    emitTime(clamped, min, selectedPeriod);
  };

  const handleHourBlur = () => {
    const num = parseInt(hourInput, 10);
    if (isNaN(num) || num < 1 || num > 12) {
      setHourInput("12");
      emitTime(12, parseInt(minuteInput, 10) || 0, selectedPeriod);
    } else {
      setHourInput(String(num));
      emitTime(num, parseInt(minuteInput, 10) || 0, selectedPeriod);
    }
  };

  const handleMinuteChange = (val: string) => {
    setMinuteInput(val);
    
    if (val === "") return;
    
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    
    const clamped = Math.max(0, Math.min(59, num));
    const h = parseInt(hourInput, 10) || 12;
    emitTime(h, clamped, selectedPeriod);
  };

  const handleMinuteBlur = () => {
    const num = parseInt(minuteInput, 10);
    const padded = isNaN(num) ? "00" : String(Math.max(0, Math.min(59, num))).padStart(2, "0");
    setMinuteInput(padded);
    emitTime(parseInt(hourInput, 10) || 12, parseInt(padded, 10), selectedPeriod);
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setSelectedPeriod(newPeriod);
    emitTime(parseInt(hourInput, 10) || 12, parseInt(minuteInput, 10) || 0, newPeriod);
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const current = parseInt(hourInput, 10) || 12;
      const next = current === 12 ? 1 : current + 1;
      setHourInput(String(next));
      emitTime(next, parseInt(minuteInput, 10) || 0, selectedPeriod);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const current = parseInt(hourInput, 10) || 12;
      const prev = current === 1 ? 12 : current - 1;
      setHourInput(String(prev));
      emitTime(prev, parseInt(minuteInput, 10) || 0, selectedPeriod);
    } else if (e.key === "Enter" || e.key === "Tab") {
      minuteRef.current?.focus();
      if (e.key === "Enter") e.preventDefault();
    }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const current = parseInt(minuteInput, 10) || 0;
      const next = current === 59 ? 0 : current + 1;
      const padded = String(next).padStart(2, "0");
      setMinuteInput(padded);
      emitTime(parseInt(hourInput, 10) || 12, next, selectedPeriod);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const current = parseInt(minuteInput, 10) || 0;
      const prev = current === 0 ? 59 : current - 1;
      const padded = String(prev).padStart(2, "0");
      setMinuteInput(padded);
      emitTime(parseInt(hourInput, 10) || 12, prev, selectedPeriod);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[0.65rem] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      
      <div className="flex items-center gap-2">
        {/* Hour Input */}
        <input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          value={hourInput}
          onChange={(e) => handleHourChange(e.target.value)}
          onKeyDown={handleHourKeyDown}
          className="w-12 h-10 text-center rounded-lg text-sm transition-all focus:outline-none"
          style={{
            background: 'var(--glass-bg-dark)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
            e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
            handleHourBlur();
          }}
          placeholder="12"
          maxLength={2}
        />
        
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>:</span>
        
        {/* Minute Input */}
        <input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          value={minuteInput}
          onChange={(e) => handleMinuteChange(e.target.value)}
          onKeyDown={handleMinuteKeyDown}
          className="w-12 h-10 text-center rounded-lg text-sm transition-all focus:outline-none"
          style={{
            background: 'var(--glass-bg-dark)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
            e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
            handleMinuteBlur();
          }}
          placeholder="00"
          maxLength={2}
        />
        
        {/* AM/PM Dropdown */}
        <select
          value={selectedPeriod}
          onChange={(e) => handlePeriodChange(e.target.value as "AM" | "PM")}
          className="h-10 px-2 rounded-lg text-sm transition-all focus:outline-none cursor-pointer"
          style={{
            background: 'var(--glass-bg-dark)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
            e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};
