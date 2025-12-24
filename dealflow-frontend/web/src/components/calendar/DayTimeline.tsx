import React from 'react';
import {
  getEventsForDate,
  CalendarEvent,
  formatDate,
  generateTimeSlots,
  timeToMinutes,
  MONTHS,
  DAYS_OF_WEEK_FULL,
  isToday,
} from './calendarUtils';

interface DayTimelineProps {
  year: number;
  month: number;
  day: number;
  events: CalendarEvent[];
  onTimeSlotClick?: (hour: number, minutes: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onBackToMonth?: () => void;
  onCreateEvent?: () => void;
}

export const DayTimeline: React.FC<DayTimelineProps> = ({
  year,
  month,
  day,
  events,
  onTimeSlotClick,
  onEventClick,
  onCreateEvent,
}) => {
  const date = formatDate(year, month, day);
  const dayEvents = getEventsForDate(events, date);
  const timeSlots = generateTimeSlots();
  const dateObj = new Date(year, month, day);
  const dayName = DAYS_OF_WEEK_FULL[dateObj.getDay()];
  const monthName = MONTHS[month];
  const isTodayDate = isToday(year, month, day);

  const getEventStyle = (event: CalendarEvent) => {
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
          {/* Day header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-1">
                {dayName}
              </div>
              <div className={`text-2xl font-semibold ${isTodayDate ? 'text-[#ff0a45]' : 'text-white'}`}>
                {day}
              </div>
              <div className="text-sm text-neutral-400 mt-1">
                {monthName} {year}
              </div>
            </div>
          </div>

          {/* Time slots */}
          <div className="relative overflow-y-auto" style={{ height: 'calc(100vh - 400px)', minHeight: '1200px' }}>
            <div className="relative" style={{ height: '1200px' }}>
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
                  onTimeSlotClick?.(slot.hour, snappedMinutes ?? 0);
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
              <div className="absolute inset-0 pointer-events-none">
                {dayEvents
                  .filter(e => e.startTime && e.endTime)
                  .map(event => {
                    const style = getEventStyle(event);
                    if (style.display === 'none') return null;
                    
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        className="absolute left-2 right-2 rounded-2xl bg-[#ff0a45]/20 border border-[#ff0a45]/60 px-3 py-2 text-xs text-white shadow-[0_0_16px_rgba(255,10,69,0.8)] cursor-pointer pointer-events-auto"
                        style={style}
                      >
                        <div className="font-medium">{event.title}</div>
                        {event.startTime && event.endTime && (
                          <div className="text-[10px] opacity-70 font-mono">
                            {event.startTime} - {event.endTime}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

