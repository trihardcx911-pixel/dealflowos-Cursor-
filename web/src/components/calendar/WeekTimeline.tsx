import React from 'react';
import {
  getEventsForDate,
  CalendarEvent,
  generateTimeSlots,
  formatTimeForDisplay,
  getEventSegmentForRow,
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
  
  const HOUR_HEIGHT_PX = 50;
  const GRID_HEIGHT_PX = timeSlots.length * HOUR_HEIGHT_PX;

  /**
   * Row-owned calendar architecture:
   * - Each hour row owns its label, grid cells (7 columns), and event segments
   * - Events are positioned relative to their row (0-50px), not the entire grid
   * - Multi-hour events split into segments, one per overlapping row
   * - No global absolute overlay spans multiple hours
   */

  return (
    <div className="space-y-4">
      {/* Scrollable timeline column */}
      <div className="rounded-2xl bg-[#070512]/80 border border-[#ff0a45]/20 backdrop-blur-lg overflow-hidden">
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
          <div className="overflow-y-auto relative" style={{ height: 'calc(100vh - 400px)', minHeight: `${GRID_HEIGHT_PX}px` }}>
            <div style={{ height: `${GRID_HEIGHT_PX}px` }}>
              {timeSlots.map((slot) => (
                <div key={slot.hour} className="hour-row flex" style={{ height: '50px' }}>
                  <div className="hour-label w-[72px] h-[50px] flex items-start text-xs text-neutral-500">
                    <span className="font-mono">{slot.label}</span>
                  </div>
                  <div className="hour-grid grid grid-cols-7 flex-1 h-[50px]">
                    {weekDates.map((date, colIndex) => {
                      const snapToQuarter = (min: number) => Math.round(min / 15) * 15;
                      
                      const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const clickPosition = clickY / HOUR_HEIGHT_PX; // 0-1 within the slot
                        const clickedMinutes = Math.round(clickPosition * 60);
                        const snappedMinutes = snapToQuarter(clickedMinutes);
                        
                        // Always pass minutes (default to 0 if snapped is invalid)
                        onTimeSlotClick?.(date.year, date.month, date.day, slot.hour, snappedMinutes ?? 0);
                      };
                      
                      // Get event segments for this date that overlap this hour row
                      // Multi-hour events split into segments, one per overlapping row
                      const dayEventsForDate = getEventsForDate(events, date.date);
                      const eventSegments = dayEventsForDate
                        .map(event => {
                          const segment = getEventSegmentForRow(event, slot.hour, HOUR_HEIGHT_PX);
                          return segment ? { event, segment } : null;
                        })
                        .filter((item): item is { event: CalendarEvent; segment: { topPx: number; heightPx: number } } => item !== null);
                      
                      return (
                        <div
                          key={colIndex}
                          className="border-r border-white/5 last:border-r-0 relative"
                        >
                          <div
                            onClick={handleClick}
                            className="border-t border-white/5 hover:bg-white/3 transition cursor-pointer"
                            style={{ height: '50px', minHeight: '50px' }}
                          />
                          <div className="events-in-row absolute inset-0 pointer-events-none">
                            {eventSegments.map(({ event, segment }) => (
                              <div
                                key={`${event.id}-${date.date}-${slot.hour}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                                className="absolute left-2 right-2 rounded-2xl bg-[#ff0a45]/20 border border-[#ff0a45]/60 text-xs text-white shadow-[0_0_16px_rgba(255,10,69,0.8)] cursor-pointer pointer-events-auto"
                                style={{
                                  top: `${segment.topPx}px`,
                                  height: `${segment.heightPx}px`,
                                  bottom: 'auto',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'stretch',
                                }}
                              >
                                <div className="event-inner h-full w-full px-3 py-2 flex flex-col justify-start">
                                  <div>
                                    <div className="font-medium truncate">{event.title}</div>

                                    {import.meta.env.DEV && import.meta.env.VITE_TRANSLATION_DEBUG === 'true' && (
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
                                      {formatTimeForDisplay(event.startTime)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
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
  );
};

