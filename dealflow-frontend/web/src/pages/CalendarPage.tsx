import React, { useState, useEffect } from 'react';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { DayTimeline } from '../components/calendar/DayTimeline';
import { WeekTimeline } from '../components/calendar/WeekTimeline';
import { EventModal } from '../components/calendar/EventModal';
import { CalendarViewSwitcher } from '../components/calendar/CalendarViewSwitcher';
import BackToDashboard from '../components/BackToDashboard';
import {
  CalendarEvent,
  formatDate,
  MONTHS,
} from '../components/calendar/calendarUtils';
import { get, post, patch, del } from '../api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type ViewType = 'month' | 'week' | 'day';

// Helper to pad numbers to 2 digits
const pad = (n: number | undefined): string => {
  const num = n ?? 0;
  return String(num).padStart(2, '0');
};

export const CalendarPage: React.FC = () => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentDay, setCurrentDay] = useState(today.getDate());
  const [viewMode, setViewMode] = useState<ViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalDate, setEventModalDate] = useState<string | undefined>();
  const [eventModalHour, setEventModalHour] = useState<number | undefined>();
  const [eventModalMinutes, setEventModalMinutes] = useState<number | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);

  // Load events for current month
  const loadEvents = async () => {
    setLoading(true);
    try {
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const response = await get<{ events: any[] }>(`/calendar/month?date=${monthStr}`);
      const formattedEvents = response.events.map((e: any) => ({
        id: e.id,
        title: e.title,
        date: new Date(e.date).toISOString().split('T')[0],
        startTime: new Date(e.startTime).toTimeString().slice(0, 5),
        endTime: new Date(e.endTime).toTimeString().slice(0, 5),
        notes: e.notes,
        urgency: e.urgency || 'medium',
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      // Fallback to empty array on error
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, currentMonth]);

  const handleDayClick = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    setCurrentYear(year);
    setCurrentMonth(month);
    setCurrentDay(day);
    setSelectedDate(date);
    setViewMode('day');
  };

  const handleTimeSlotClick = (year: number, month: number, day: number, hour: number, minutes: number) => {
    const dateStr = formatDate(year, month, day);
    setEventModalDate(dateStr);
    setEventModalHour(hour);
    setEventModalMinutes(minutes ?? 0); // Always default to 0 if undefined
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleDayTimeSlotClick = (hour: number, minutes: number) => {
    if (selectedDate) {
      handleTimeSlotClick(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        hour,
        minutes ?? 0 // Always default to 0 if undefined
      );
    }
  };

  const handleCreateEvent = () => {
    const date = selectedDate || new Date(currentYear, currentMonth, currentDay);
    const dateStr = formatDate(date.getFullYear(), date.getMonth(), date.getDate());
    setEventModalDate(dateStr);
    setEventModalHour(9);
    setEventModalMinutes(0);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventModalDate(event.date);
    if (event.startTime) {
      const [hours, mins] = event.startTime.split(':').map(Number);
      setEventModalHour(hours);
      setEventModalMinutes(mins || 0);
    } else {
      setEventModalHour(9);
      setEventModalMinutes(0);
    }
    setIsEventModalOpen(true);
  };

  const handleEventSave = async (event: CalendarEvent) => {
    try {
      // Ensure date is YYYY-MM-DD format only
      const dateStr = event.date.split('T')[0];
      
      // Enforce correct time formatting using pad helper
      // If eventModalHour/Minutes are available, use them; otherwise parse from event times
      let startTime: string;
      let endTime: string;
      
      if (eventModalHour !== undefined && eventModalMinutes !== undefined) {
        // Use the modal's hour/minute values directly
        startTime = `${pad(eventModalHour)}:${pad(eventModalMinutes)}`;
        
        // Calculate end time (1 hour later, or use event.endTime if it exists and is valid)
        if (event.endTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(event.endTime)) {
          endTime = event.endTime;
        } else {
          // Auto-calculate end time as start + 1 hour
          const endHour = eventModalHour === 23 ? 0 : eventModalHour + 1;
          const endMinutes = eventModalMinutes;
          endTime = `${pad(endHour)}:${pad(endMinutes)}`;
        }
      } else {
        // Fallback: parse and reformat from event times
        const startMatch = (event.startTime || '').match(/^(\d{1,2}):(\d{1,2})$/);
        const endMatch = (event.endTime || '').match(/^(\d{1,2}):(\d{1,2})$/);
        
        if (startMatch) {
          const h = parseInt(startMatch[1], 10);
          const m = parseInt(startMatch[2], 10);
          startTime = `${pad(h)}:${pad(m)}`;
        } else {
          startTime = '09:00'; // Default fallback
        }
        
        if (endMatch) {
          const h = parseInt(endMatch[1], 10);
          const m = parseInt(endMatch[2], 10);
          endTime = `${pad(h)}:${pad(m)}`;
        } else {
          // Default to start + 1 hour
          const startMatch2 = startTime.match(/^(\d{1,2}):(\d{1,2})$/);
          if (startMatch2) {
            const h = parseInt(startMatch2[1], 10);
            const m = parseInt(startMatch2[2], 10);
            const endH = h === 23 ? 0 : h + 1;
            endTime = `${pad(endH)}:${pad(m)}`;
          } else {
            endTime = '10:00'; // Default fallback
          }
        }
      }
      
      // Final validation: ensure times are in HH:mm format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime)) {
        console.error('Invalid start time format:', startTime);
        alert('Invalid start time format. Please try again.');
        return;
      }
      if (!timeRegex.test(endTime)) {
        console.error('Invalid end time format:', endTime);
        alert('Invalid end time format. Please try again.');
        return;
      }

      if (editingEvent && editingEvent.id === event.id) {
        // Update existing event
        const response = await patch<any>(`/calendar/update/${editingEvent.id}`, {
          title: event.title,
          date: dateStr,
          startTime,
          endTime,
          notes: event.notes,
          urgency: event.urgency || 'medium',
        });
        const updatedEvent = {
          ...event,
          id: response.id,
          date: dateStr,
          startTime,
          endTime,
        };
        setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      } else {
        // Create new event
        const response = await post<any>('/calendar/create', {
          title: event.title,
          date: dateStr,
          startTime,
          endTime,
          notes: event.notes,
          urgency: event.urgency || 'medium',
        });
        const newEvent = {
          ...event,
          id: response.id,
          date: dateStr,
          startTime,
          endTime,
        };
        setEvents(prev => [...prev, newEvent]);
      }
      setEditingEvent(null);
      await loadEvents();
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('Failed to save event');
    }
  };

  const handleEventDelete = async (eventId: string | number) => {
    try {
      await del(`/calendar/${eventId}`);
      setEvents(prev => prev.filter(e => String(e.id) !== String(eventId)));
      setEditingEvent(null);
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Failed to delete event');
    }
  };

  const handlePrevPeriod = () => {
    if (viewMode === 'month') {
      if (currentMonth === 0) {
        setCurrentYear(currentYear - 1);
        setCurrentMonth(11);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      const days = viewMode === 'week' ? 7 : 1;
      const date = selectedDate || new Date(currentYear, currentMonth, currentDay);
      const newDate = new Date(date);
      newDate.setDate(date.getDate() - days);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
      setSelectedDate(newDate);
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'month') {
      if (currentMonth === 11) {
        setCurrentYear(currentYear + 1);
        setCurrentMonth(0);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    } else {
      const days = viewMode === 'week' ? 7 : 1;
      const date = selectedDate || new Date(currentYear, currentMonth, currentDay);
      const newDate = new Date(date);
      newDate.setDate(date.getDate() + days);
      setCurrentYear(newDate.getFullYear());
      setCurrentMonth(newDate.getMonth());
      setCurrentDay(newDate.getDate());
      setSelectedDate(newDate);
    }
  };

  const handleTodayClick = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setCurrentDay(now.getDate());
    setSelectedDate(now);
  };

  const handleViewChange = (view: ViewType) => {
    setViewMode(view);
    const date = selectedDate || new Date(currentYear, currentMonth, currentDay);
    setSelectedDate(date);
    setCurrentYear(date.getFullYear());
    setCurrentMonth(date.getMonth());
    setCurrentDay(date.getDate());
  };

  const handleBackToMonth = () => {
    setViewMode('month');
  };

  const displayDate = selectedDate || new Date(currentYear, currentMonth, currentDay);
  const selectedYear = displayDate.getFullYear();
  const selectedMonth = displayDate.getMonth();
  const selectedDay = displayDate.getDate();

  const handleWeekDayClick = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    setCurrentYear(year);
    setCurrentMonth(month);
    setCurrentDay(day);
    setSelectedDate(date);
    setViewMode('day');
  };

  // Format date label based on view mode
  const getDateLabel = () => {
    if (viewMode === 'month') {
      return `${MONTHS[currentMonth]} ${currentYear}`;
    } else if (viewMode === 'week') {
      const weekStart = new Date(selectedYear, selectedMonth, selectedDay);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return weekStart.getMonth() === weekEnd.getMonth()
        ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
        : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    } else {
      return `${MONTHS[selectedMonth]} ${selectedDay}, ${selectedYear}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0d]">
      <div className="max-w-[1400px] mx-auto px-12 py-10">
        <BackToDashboard />
        {/* Header */}
        <div className="mb-8">
          <p className="text-[0.7rem] tracking-[0.35em] uppercase text-neutral-400">
            Planning
          </p>
          <div className="mt-2 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Calendar
              </h1>
              <p className="mt-1 text-sm text-neutral-400 max-w-xl">
                Plan follow-ups, appointments, and closing tasks in a single neon timeline.
              </p>
            </div>
            
            {/* Controls row */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleTodayClick}
                className="px-4 py-2 rounded-xl border border-[#ff0a45]/30 bg-[#ff0a45]/5 text-[#ff0a45] hover:bg-[#ff0a45]/10 hover:border-[#ff0a45]/50 hover:shadow-[0_0_10px_#ff0a45] transition-all text-sm font-medium"
              >
                Today
              </button>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevPeriod}
                  className="p-2 text-neutral-400 hover:text-[#ff0a45] transition-colors rounded-lg hover:bg-white/5"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextPeriod}
                  className="p-2 text-neutral-400 hover:text-[#ff0a45] transition-colors rounded-lg hover:bg-white/5"
                  aria-label="Next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="text-lg font-medium text-white">
                {getDateLabel()}
              </div>

              <button
                onClick={handleCreateEvent}
                className="px-4 py-2 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] hover:shadow-[0_0_15px_#ff0a45] transition-all text-sm font-medium"
              >
                Create Event
              </button>
              
              <CalendarViewSwitcher viewMode={viewMode} onViewChange={handleViewChange} />
            </div>
          </div>
        </div>

        {/* Main glass panel */}
        <div className="rounded-[32px] bg-[#05000b]/85 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_40px_rgba(255,10,69,0.18)] p-6 md:p-8">
          {viewMode === 'month' && (
            loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-neutral-400">Loading...</div>
              </div>
            ) : (
              <MonthGrid
                year={currentYear}
                month={currentMonth}
                events={events}
                selectedDate={selectedDate}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
              />
            )
          )}

          {viewMode === 'week' && (
            <WeekTimeline
              year={selectedYear}
              month={selectedMonth}
              day={selectedDay}
              events={events}
              onDayClick={handleWeekDayClick}
              onTimeSlotClick={handleTimeSlotClick}
              onEventClick={handleEventClick}
              onCreateEvent={handleCreateEvent}
            />
          )}

          {viewMode === 'day' && (
            <DayTimeline
              year={selectedYear}
              month={selectedMonth}
              day={selectedDay}
              events={events}
              onTimeSlotClick={handleDayTimeSlotClick}
              onEventClick={handleEventClick}
              onBackToMonth={handleBackToMonth}
              onCreateEvent={handleCreateEvent}
            />
          )}
        </div>
      </div>

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
          setEventModalDate(undefined);
          setEventModalHour(undefined);
          setEventModalMinutes(undefined);
        }}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        initialDate={eventModalDate}
        initialHour={eventModalHour}
        initialMinutes={eventModalMinutes}
        existingEvent={editingEvent}
      />
    </div>
  );
};

export default CalendarPage;
