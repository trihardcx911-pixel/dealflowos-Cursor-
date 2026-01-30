import React from 'react';
import {
  getEventsForDate,
  CalendarEvent,
  formatDate,
  generateTimeSlots,
  formatTimeForDisplay,
  getEventSegmentForRow,
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
  onEventClick?: (event: CalendarEvent, anchorElement?: HTMLElement) => void;
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
  
  const HOUR_HEIGHT_PX = 50;
  const GRID_HEIGHT_PX = timeSlots.length * HOUR_HEIGHT_PX;

  /**
   * Row-owned calendar architecture:
   * - Each hour row owns its label, grid cell, and event segments
   * - Events are positioned relative to their row (0-50px), not the entire grid
   * - Multi-hour events split into segments, one per overlapping row
   * - No global absolute overlay spans multiple hours
   */

  return (
    <div className="space-y-4">
      {/* Scrollable timeline column */}
      <div className="rounded-2xl bg-[#070512]/80 border border-[#ff0a45]/20 backdrop-blur-lg overflow-hidden">
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
          <div className="overflow-y-auto relative" style={{ height: 'calc(100vh - 400px)', minHeight: `${GRID_HEIGHT_PX}px` }}>
            <div style={{ height: `${GRID_HEIGHT_PX}px` }}>
              {timeSlots.map((slot) => {
                const snapToQuarter = (min: number) => Math.round(min / 15) * 15;
                
                const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const clickPosition = clickY / HOUR_HEIGHT_PX; // 0-1 within the slot
                  const clickedMinutes = Math.round(clickPosition * 60);
                  const snappedMinutes = snapToQuarter(clickedMinutes);
                  
                  // Always pass minutes (default to 0 if snapped is invalid)
                  onTimeSlotClick?.(slot.hour, snappedMinutes ?? 0);
                };
                
                // Get event segments that overlap this hour row
                // Multi-hour events split into segments, one per overlapping row
                const eventSegments = dayEvents
                  .map(event => {
                    const segment = getEventSegmentForRow(event, slot.hour, HOUR_HEIGHT_PX);
                    return segment ? { event, segment } : null;
                  })
                  .filter((item): item is { event: CalendarEvent; segment: { topPx: number; heightPx: number } } => item !== null);

                return (
                  <div key={slot.hour} className="hour-row flex" style={{ height: '50px' }}>
                    <div className="hour-label w-[72px] h-[50px] flex items-start text-xs text-neutral-500">
                      <span className="font-mono">{slot.label}</span>
                    </div>
                    <div className="hour-grid flex-1 relative h-[50px]">
                      <div
                        onClick={handleClick}
                        className="border-t border-white/5 hover:bg-white/3 transition cursor-pointer relative"
                        style={{ height: '50px', minHeight: '50px' }}
                      >
                        {/* Half-hour grid line indicator (subtle visual aid for 30-minute segments) */}
                        <div
                          className="absolute left-0 right-0 pointer-events-none"
                          style={{
                            top: '50%',
                            height: '1px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.05)',
                          }}
                        />
                      </div>
                      <div className="events-in-row absolute inset-0 pointer-events-none">
                        {eventSegments.map(({ event, segment }) => (
                          <div
                            key={`${event.id}-${slot.hour}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const target = e.currentTarget as HTMLElement;
                              onEventClick?.(event, target);
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
                              {event.startTime && event.endTime && (
                                <div className="text-[10px] opacity-70 font-mono">
                                  {formatTimeForDisplay(event.startTime)} - {formatTimeForDisplay(event.endTime)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
};

