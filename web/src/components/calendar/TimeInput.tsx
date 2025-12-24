import React, { useState, useEffect } from 'react';

interface TimeInputProps {
  value: string; // Format: "HH:mm" (24-hour)
  onChange: (time: string) => void;
  label?: string;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  label,
  className = '',
}) => {
  const [hour12, setHour12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Convert 24-hour format to 12-hour with AM/PM
  useEffect(() => {
    const [h24Str, minStr] = value.split(':');
    const h24 = parseInt(h24Str, 10);
    const min = parseInt(minStr, 10);

    setMinute(min);

    if (h24 === 0) {
      setHour12(12);
      setPeriod('AM');
    } else if (h24 < 12) {
      setHour12(h24);
      setPeriod('AM');
    } else if (h24 === 12) {
      setHour12(12);
      setPeriod('PM');
    } else {
      setHour12(h24 - 12);
      setPeriod('PM');
    }
  }, [value]);

  // Convert back to 24-hour format and notify parent
  const updateTime = (newHour12: number, newMinute: number, newPeriod: 'AM' | 'PM') => {
    let h24 = newHour12;
    
    if (newPeriod === 'AM') {
      if (newHour12 === 12) h24 = 0;
    } else {
      if (newHour12 !== 12) h24 = newHour12 + 12;
    }

    const timeStr = `${String(h24).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    onChange(timeStr);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    setHour12(newHour);
    updateTime(newHour, minute, period);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = parseInt(e.target.value, 10);
    setMinute(newMinute);
    updateTime(hour12, newMinute, period);
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value as 'AM' | 'PM';
    setPeriod(newPeriod);
    updateTime(hour12, minute, newPeriod);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-[0.65rem] uppercase tracking-wider text-neutral-500 mb-1.5">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        {/* Hour */}
        <select
          value={hour12}
          onChange={handleHourChange}
          className="h-12 flex-1 rounded-xl bg-[rgba(15,15,17,0.5)] backdrop-blur-xl border border-[rgba(255,255,255,0.04)] text-white text-center text-sm font-medium focus:border-[rgba(255,0,60,0.18)] focus:shadow-[0_0_8px_rgba(255,0,60,0.14)] focus:outline-none transition-all hover:border-[rgba(255,255,255,0.08)]"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* Separator */}
        <span className="text-[#ff0a45] font-bold text-lg">:</span>

        {/* Minute */}
        <select
          value={minute}
          onChange={handleMinuteChange}
          className="h-12 flex-1 rounded-xl bg-[rgba(15,15,17,0.5)] backdrop-blur-xl border border-[rgba(255,255,255,0.04)] text-white text-center text-sm font-medium focus:border-[rgba(255,0,60,0.18)] focus:shadow-[0_0_8px_rgba(255,0,60,0.14)] focus:outline-none transition-all hover:border-[rgba(255,255,255,0.08)]"
        >
          {[0, 15, 30, 45].map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* AM/PM */}
        <select
          value={period}
          onChange={handlePeriodChange}
          className="h-12 w-20 rounded-xl bg-[rgba(15,15,17,0.5)] backdrop-blur-xl border border-[rgba(255,255,255,0.04)] text-white text-center text-sm font-medium focus:border-[rgba(255,0,60,0.18)] focus:shadow-[0_0_8px_rgba(255,0,60,0.14)] focus:outline-none transition-all hover:border-[rgba(255,255,255,0.08)]"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};
