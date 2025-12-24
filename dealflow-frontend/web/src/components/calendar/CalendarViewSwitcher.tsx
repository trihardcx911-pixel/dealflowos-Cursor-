import React from 'react';

type ViewType = 'month' | 'week' | 'day';

interface CalendarViewSwitcherProps {
  viewMode: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const CalendarViewSwitcher: React.FC<CalendarViewSwitcherProps> = ({
  viewMode,
  onViewChange,
}) => {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-[#080712]/80 border border-[#ff0a45]/25 px-1 py-1 backdrop-blur-xl">
      <button
        onClick={() => onViewChange('month')}
        className={`px-4 py-1.5 rounded-xl text-xs md:text-sm font-medium transition-all ${
          viewMode === 'month'
            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_18px_rgba(255,10,69,0.45)]'
            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
        }`}
      >
        Month
      </button>
      <button
        onClick={() => onViewChange('week')}
        className={`px-4 py-1.5 rounded-xl text-xs md:text-sm font-medium transition-all ${
          viewMode === 'week'
            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_18px_rgba(255,10,69,0.45)]'
            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
        }`}
      >
        Week
      </button>
      <button
        onClick={() => onViewChange('day')}
        className={`px-4 py-1.5 rounded-xl text-xs md:text-sm font-medium transition-all ${
          viewMode === 'day'
            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_18px_rgba(255,10,69,0.45)]'
            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
        }`}
      >
        Day
      </button>
    </div>
  );
};

