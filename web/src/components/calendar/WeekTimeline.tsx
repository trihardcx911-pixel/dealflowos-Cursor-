import React from 'react';
import {
  getEventsForDate,
  CalendarEvent,
  generateTimeSlots,
  timeToMinutes,
  DAYS_OF_WEEK,
  getWeekDates,
  isToday,
  MONTHS,
  MONTHS_SHORT,
} from './calendarUtils';

interface WeekTimelineProps {
  year: number;
  month: number;
  day: number;
  events: CalendarEvent[];
  onDayClick?: (year: number, month: number, day: number) => void;
  onTimeSlotClick?: (year: number, month: number, day: number, hour: number, minutes: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
}

export const WeekTimeline: React.FC<WeekTimelineProps> = ({
  year,
  month,
  day,
  events,
  onDayClick,
  onTimeSlotClick,
  onEventClick,
  onCreateEvent,
}) => {
  const weekDates = getWeekDates(year, month, day);
  const timeSlots = generateTimeSlots();

  const getEventStyle = (event: CalendarEvent, colIndex: number) => {
    if (!event.startTime || !event.endTime) return { display: 'none' };
    
    const startMinutes = timeToMinutes(event.startTime);
    const endMinutes = timeToMinutes(event.endTime);
    const duration = endMinutes - startMinutes;
    
    const topPx = (startMinutes / 60) * 50;
    const heightPx = Math.max(30, (duration / 60) * 50);
    
    return {
      top: `${topPx}px`,
      height: `${heightPx}px`,
    };
  };

  return (
    <div className="space-y-4">
      {/* Timeline layout with two-column structure */}
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
        {/* Time labels column */}
        <div className="space-y-0 text-xs text-neutral-500 pt-2">
          {timeSlots.map((slot) => (
            <div key={slot.hour} className="h-[50px] flex items-start">
              <span className="font-mono">{slot.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline column */}
        <div className="relative rounded-2xl bg-[#070512]/80 border border-[#ff0a45]/20 backdrop-blur-lg overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {weekDates.map((date, idx) => {
              const isTodayDate = isToday(date.year, date.month, date.day);
              return (
                <div
                  key={idx}
                  onClick={() => onDayClick?.(date.year, date.month, date.day)}
                  className={`text-center py-3 border-r border-white/5 last:border-r-0 cursor-pointer transition-all ${
                    isTodayDate ? 'bg-[#ff0a45]/10 border-[#ff0a45]/30' : 'hover:bg-white/3'
                  }`}
                >
                  <div className="text-xs uppercase text-neutral-500 mb-1">{DAYS_OF_WEEK[idx]}</div>
                  <div className={`text-lg font-semibold ${isTodayDate ? 'text-[#ff0a45]' : 'text-white'}`}>
                    {date.day}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time slots grid */}
          <div className="relative overflow-y-auto" style={{ height: 'calc(100vh - 400px)', minHeight: '1200px' }}>
            <div className="grid grid-cols-7 relative" style={{ height: '1200px' }}>
              {weekDates.map((date, colIndex) => (
                <div key={colIndex} className="border-r border-white/5 last:border-r-0 relative">
                  {timeSlots.map((slot) => {
                    const snapToQuarter = (min: number) => Math.round(min / 15) * 15;
                    
                    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      const slotHeight = 50; // 50px per hour slot
                      const clickPosition = clickY / slotHeight; // 0-1 within the slot
                      const clickedMinutes = Math.round(clickPosition * 60);
                      const snappedMinutes = snapToQuarter(clickedMinutes);
                      
                      // Always pass minutes (default to 0 if snapped is invalid)
                      onTimeSlotClick?.(date.year, date.month, date.day, slot.hour, snappedMinutes ?? 0);
                    };
                    
                    return (
                      <div
                        key={slot.hour}
                        onClick={handleClick}
                        className="border-t border-white/5 hover:bg-white/3 transition cursor-pointer"
                        style={{ height: '50px', minHeight: '50px' }}
                      />
                    );
                  })}

                  {/* Events */}
                  <div className="absolute inset-0 pointer-events-none px-0.5">
                    {getEventsForDate(events, date.date)
                      .filter(e => e.startTime && e.endTime)
                      .map((event) => {
                        const style = getEventStyle(event, colIndex);
                        if (style.display === 'none') return null;
                        
                        return (
                          <div
                            key={`${event.id}-${colIndex}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className="absolute left-2 right-2 rounded-2xl bg-[#ff0a45]/20 border border-[#ff0a45]/60 px-3 py-2 text-xs text-white shadow-[0_0_16px_rgba(255,10,69,0.8)] cursor-pointer pointer-events-auto"
                            style={style}
                          >
                            <div>
                              <div className="font-medium truncate">{event.title}</div>

                              {(window as any)?.dfos_auto_translate !== false && (
                                <button
                                  className="mt-0.5 text-[0.65rem] text-[#ff0a45]/70 hover:text-[#ff0a45] underline"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    alert(`Translation:\n\n${event.title}`);
                                  }}
                                >
                                  View translation
                                </button>
                              )}
                            </div>
                            {event.startTime && (
                              <div className="text-[10px] opacity-70 font-mono">
                                {event.startTime}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

