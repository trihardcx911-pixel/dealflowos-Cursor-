/**
 * In-Memory Calendar Store (Dev Mode Only)
 * 
 * Used when DATABASE_URL is not available for local development.
 */

interface CalendarEvent {
  id: number;
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  urgency: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage: userId -> CalendarEvent[]
const eventsByUser: Record<string, CalendarEvent[]> = {};

let nextId = 1;

/**
 * Get all events for a user
 */
export function getUserEvents(userId: string): CalendarEvent[] {
  return eventsByUser[userId] || [];
}

/**
 * Get events for a specific date range
 */
export function getEventsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  const userEvents = getUserEvents(userId);
  return userEvents.filter(event => {
    return event.date >= startDate && event.date <= endDate;
  });
}

/**
 * Get a single event by ID and userId (ownership check)
 */
export function getEventById(eventId: number, userId: string): CalendarEvent | null {
  const userEvents = getUserEvents(userId);
  return userEvents.find(e => e.id === eventId) || null;
}

/**
 * Create a new event
 */
export function createEvent(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
  const event: CalendarEvent = {
    ...data,
    id: nextId++,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!eventsByUser[data.userId]) {
    eventsByUser[data.userId] = [];
  }

  eventsByUser[data.userId].push(event);
  return event;
}

/**
 * Update an event (with ownership check)
 */
export function updateEvent(
  eventId: number,
  userId: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'userId' | 'createdAt'>>
): CalendarEvent | null {
  const userEvents = eventsByUser[userId] || [];
  const eventIndex = userEvents.findIndex(e => e.id === eventId);

  if (eventIndex === -1) {
    return null; // Not found or ownership mismatch
  }

  const event = userEvents[eventIndex];
  const updatedEvent = {
    ...event,
    ...updates,
    updatedAt: new Date(),
  };

  userEvents[eventIndex] = updatedEvent;
  return updatedEvent;
}

/**
 * Delete an event (with ownership check)
 */
export function deleteEvent(eventId: number, userId: string): boolean {
  const userEvents = eventsByUser[userId] || [];
  const eventIndex = userEvents.findIndex(e => e.id === eventId);

  if (eventIndex === -1) {
    return false; // Not found or ownership mismatch
  }

  userEvents.splice(eventIndex, 1);
  return true;
}










