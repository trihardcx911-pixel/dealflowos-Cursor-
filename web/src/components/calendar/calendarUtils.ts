// Calendar utility functions for accurate date calculations

export interface CalendarEvent {
  id: string | number;
  title: string;
  date: string; // Format: "YYYY-MM-DD"
  color?: string;
  startTime?: string; // Format: "HH:mm" (24-hour)
  endTime?: string; // Format: "HH:mm" (24-hour)
  notes?: string | null;
  urgency?: 'low' | 'medium' | 'critical';
  // Phase 2: Reminder fields
  enableReminder?: boolean;
  reminderOffset?: number;
  reminderChannel?: string;
}

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Get the number of days in a given month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of the week (0-6, where 0 is Sunday) for the first day of a month
 */
export function getFirstDayOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Check if a date is today
 */
export function isToday(year: number, month: number, day: number): boolean {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(year: number, month: number, day: number): string {
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

/**
 * Parse YYYY-MM-DD string to Date object
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter(event => event.date === date);
}

/**
 * Generate calendar grid cells for a month
 * Returns array of { year, month, day, isCurrentMonth } objects
 */
export function generateCalendarGrid(year: number, month: number): Array<{
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  date: string;
}> {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOffset(year, month);
  const cells: Array<{ year: number; month: number; day: number; isCurrentMonth: boolean; date: string }> = [];

  // Previous month's trailing days
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
  
  for (let i = firstDayOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      year: prevYear,
      month: prevMonth,
      day,
      isCurrentMonth: false,
      date: formatDate(prevYear, prevMonth, day),
    });
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      year,
      month,
      day,
      isCurrentMonth: true,
      date: formatDate(year, month, day),
    });
  }

  // Next month's leading days to fill the grid (always 6 rows = 42 cells)
  const remainingCells = Math.max(0, 42 - cells.length);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  for (let day = 1; day <= remainingCells; day++) {
    cells.push({
      year: nextYear,
      month: nextMonth,
      day,
      isCurrentMonth: false,
      date: formatDate(nextYear, nextMonth, day),
    });
  }

  // Ensure exactly 42 cells (6 rows x 7 columns)
  return cells.slice(0, 42);
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Parse HH:mm time string to total minutes since midnight
 * Example: "09:15" → 555, "14:30" → 870
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Calculate the segment of an event that overlaps with a specific hour row.
 * 
 * This function implements the row-owned calendar architecture where:
 * - Each hour row independently decides which event segments it renders
 * - Positioning is row-relative (0-50px per row), not grid-relative (0-800px)
 * - Multi-hour events split into multiple segments across overlapping rows
 * - Each segment's position is calculated relative to its row's origin (0px = start of hour)
 * 
 * Geometry:
 * - Row boundaries: rowStart = rowHour * 60 minutes, rowEnd = rowStart + 60
 * - Intersection: segmentStart = max(eventStart, rowStart), segmentEnd = min(eventEnd, rowEnd)
 * - Row-relative: topPx = (segmentStart - rowStart) / 60 * hourHeightPx
 * - Height: heightPx = (segmentEnd - segmentStart) / 60 * hourHeightPx
 * 
 * @param event - Calendar event with startTime and endTime (HH:mm format)
 * @param rowHour - The hour this row represents (e.g., 9 for 9:00 AM row)
 * @param hourHeightPx - Height of one hour row in pixels (default: 50)
 * @returns Object with topPx and heightPx (numbers), or null if event doesn't overlap this row
 */
export function getEventSegmentForRow(
  event: CalendarEvent,
  rowHour: number,
  hourHeightPx = 50
): { topPx: number; heightPx: number } | null {
  if (!event.startTime || !event.endTime) return null;
  
  // Convert event times to minutes since midnight
  const eventStartMinutes = parseTimeToMinutes(event.startTime);
  const eventEndMinutes = parseTimeToMinutes(event.endTime);
  
  // Guard: invalid event (end <= start)
  if (eventEndMinutes <= eventStartMinutes) return null;
  
  // Define row boundaries
  const rowStartMinutes = rowHour * 60;
  const rowEndMinutes = rowStartMinutes + 60;
  
  // Calculate intersection segment
  const segmentStartMinutes = Math.max(eventStartMinutes, rowStartMinutes);
  const segmentEndMinutes = Math.min(eventEndMinutes, rowEndMinutes);
  
  // Check if segment is valid (no overlap if segmentEnd <= segmentStart)
  if (segmentEndMinutes <= segmentStartMinutes) return null;
  
  // Calculate row-relative positioning in minutes
  const minutesIntoRow = segmentStartMinutes - rowStartMinutes;
  const durationMinutes = segmentEndMinutes - segmentStartMinutes;
  
  // Convert to pixels (fractional pixels allowed for sub-hour precision)
  const topPx = (minutesIntoRow / 60) * hourHeightPx;
  const heightPx = (durationMinutes / 60) * hourHeightPx;
  
  // Minimal clamping to enforce bounds: topPx >= 0, heightPx >= 0, topPx + heightPx <= hourHeightPx
  const clampedTop = Math.max(0, topPx);
  let clampedHeight = Math.max(0, Math.min(heightPx, hourHeightPx - clampedTop));
  
  // Ensure minimum visible height for very short events (e.g., 5-minute events)
  // This prevents events from "disappearing" when they're too short
  const MIN_VISIBLE_HEIGHT_PX = 4; // 4px minimum (about 5 minutes at 50px/hour)
  if (clampedHeight > 0 && clampedHeight < MIN_VISIBLE_HEIGHT_PX) {
    clampedHeight = MIN_VISIBLE_HEIGHT_PX;
    // Adjust top if needed to keep within bounds
    if (clampedTop + clampedHeight > hourHeightPx) {
      clampedHeight = Math.max(MIN_VISIBLE_HEIGHT_PX, hourHeightPx - clampedTop);
    }
  }
  
  return {
    topPx: clampedTop,
    heightPx: clampedHeight,
  };
}

/**
 * Format 24-hour time string (HH:mm) to 12-hour display format (h:mm AM/PM)
 * This is UI-only formatting - internal logic remains 24-hour based
 */
export function formatTimeForDisplay(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Generate time slots for day view (8AM - 11PM)
 * Grid starts at GRID_START_HOUR to align with event positioning
 */
export function generateTimeSlots(): Array<{ hour: number; label: string; minutes: number }> {
  const GRID_START_HOUR = 8; // 8:00 AM is the first visible hour (matches event positioning)
  const GRID_END_HOUR = 23; // 11:00 PM is the last visible hour
  
  const slots: Array<{ hour: number; label: string; minutes: number }> = [];
  for (let hour = GRID_START_HOUR; hour <= GRID_END_HOUR; hour++) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    slots.push({
      hour, // Keep actual hour (8-23) for click handling compatibility
      label: `${displayHour}:00 ${period}`,
      minutes: 0, // Always 0 for hourly slots
    });
  }
  return slots;
}

/**
 * Get event color or default to neon red
 */
export function getEventColor(event: CalendarEvent): string {
  return event.color || '#ff0a45';
}

/**
 * Generate a color for an event based on its index or title
 */
export function generateEventColor(index: number): string {
  const colors = [
    '#ff0a45', // neon red (default)
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];
  return colors[index % colors.length];
}

/**
 * Get week dates for a given date
 */
export function getWeekDates(year: number, month: number, day: number): Array<{ year: number; month: number; day: number; date: string }> {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay();
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - dayOfWeek);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    weekDates.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      date: formatDate(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  return weekDates;
}

