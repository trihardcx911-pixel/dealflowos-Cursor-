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
 * Generate time slots for day view (12AM - 11PM)
 */
export function generateTimeSlots(): Array<{ hour: number; label: string; minutes: number }> {
  const slots: Array<{ hour: number; label: string; minutes: number }> = [];
  for (let hour = 0; hour <= 23; hour++) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    slots.push({
      hour,
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

