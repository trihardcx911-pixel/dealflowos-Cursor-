import React from 'react';
import {
  generateCalendarGrid,
  getEventsForDate,
  isToday,
  isSameDay,
  CalendarEvent,
  DAYS_OF_WEEK,
  formatDate,
} from './calendarUtils';

interface MonthGridProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onDayClick: (year: number, month: number, day: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  year,
  month,
  events,
  selectedDate,
  onDayClick,
  onEventClick,
}) => {
  const gridCells = generateCalendarGrid(year, month);

  const handleCellClick = (cell: typeof gridCells[0]) => {
    onDayClick(cell.year, cell.month, cell.day);
  };

  return (
    <div className="space-y-4">
      {/* Weekday header row */}
      <div className="grid grid-cols-7 gap-3 text-[0.7rem] tracking-[0.2em] uppercase text-neutral-500">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-3">
        {gridCells.slice(0, 42).map((cell, index) => {
          const cellEvents = cell.isCurrentMonth
            ? getEventsForDate(events, cell.date)
            : [];
          const isSelected = selectedDate &&
            isSameDay(selectedDate, new Date(cell.year, cell.month, cell.day));
          const isTodayDate = cell.isCurrentMonth && isToday(cell.year, cell.month, cell.day);

          const visibleEvents = cellEvents.slice(0, 3);

          return (
            <div
              key={index}
              onClick={() => handleCellClick(cell)}
              className={`relative flex flex-col rounded-2xl bg-[#070512]/80 border backdrop-blur-lg p-3 min-h-[110px] transition-all duration-200 cursor-pointer ${
                isTodayDate 
                  ? "border-[#ff0a45]/70 shadow-[0_0_18px_rgba(255,10,69,0.6)]" 
                  : isSelected 
                    ? "border-[#ff0a45]/90 bg-[#0b071c]/90" 
                    : "border-transparent"
              } ${!cell.isCurrentMonth ? "opacity-40" : ""}`}
            >
              {/* Date label */}
              <div className="flex items-center justify-end mb-2">
                <span className="text-sm font-semibold text-white">
                  {cell.day}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className="w-full truncate rounded-xl bg-[#ff0a45]/15 border border-[#ff0a45]/40 px-2 py-1 text-[0.7rem] text-neutral-100 text-left hover:bg-[#ff0a45]/25 hover:shadow-[0_0_12px_rgba(255,10,69,0.6)] transition"
                  >
                    {event.title}
                  </button>
                ))}
                {cellEvents.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(cell);
                    }}
                    className="text-xs text-neutral-500 hover:text-[#ff0a45] px-2 py-0.5 transition-colors cursor-pointer"
                  >
                    +{cellEvents.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

