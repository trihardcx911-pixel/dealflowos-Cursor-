import React, { useState, useEffect } from 'react';
import { CalendarEvent, formatDate, minutesToTime, timeToMinutes } from './calendarUtils';
import { X } from 'lucide-react';

// Helper to pad numbers to 2 digits
const pad = (n: number | undefined): string => {
  const num = n ?? 0;
  return String(num).padStart(2, '0');
};

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string | number) => void;
  initialDate?: string;
  initialHour?: number;
  initialMinutes?: number;
  existingEvent?: CalendarEvent | null;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialHour,
  initialMinutes,
  existingEvent,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'critical'>('medium');
  
  // Internal state for time dialer
  const [startHour, setStartHour] = useState<number>(9);
  const [startMin, setStartMin] = useState<number>(0);
  const [endHour, setEndHour] = useState<number>(10);
  const [endMin, setEndMin] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    
    if (existingEvent) {
      setTitle(existingEvent.title);
      setDate(existingEvent.date);
      const existingStart = existingEvent.startTime || '09:00';
      const existingEnd = existingEvent.endTime || '10:00';
      setStartTime(existingStart);
      setEndTime(existingEnd);
      
      // Parse existing times for dialer
      const [sh, sm] = existingStart.split(':').map(Number);
      const [eh, em] = existingEnd.split(':').map(Number);
      setStartHour(sh ?? 9);
      setStartMin(sm ?? 0);
      setEndHour(eh ?? 10);
      setEndMin(em ?? 0);
      
      setNotes(existingEvent.notes || '');
      setUrgency(existingEvent.urgency || 'medium');
    } else {
      setTitle('');
      setNotes('');
      setUrgency('medium');
      if (initialDate) {
        setDate(initialDate);
      }
      if (initialHour !== undefined) {
        // initialHour is 0-23, initialMinutes defaults to 0 if undefined
        const sh = initialHour;
        const sm = initialMinutes ?? 0; // Always default to 0 if undefined
        // End time is 1 hour later (handle 23 -> 0 wrap)
        const eh = sh === 23 ? 0 : sh + 1;
        const em = sm;
        
        setStartHour(sh);
        setStartMin(sm);
        setEndHour(eh);
        setEndMin(em);
        
        setStartTime(`${pad(sh)}:${pad(sm)}`);
        setEndTime(`${pad(eh)}:${pad(em)}`);
      } else {
        setStartHour(9);
        setStartMin(0);
        setEndHour(10);
        setEndMin(0);
        setStartTime('09:00');
        setEndTime('10:00');
      }
    }
  }, [existingEvent, initialDate, initialHour, initialMinutes, isOpen]);
  
  // Update time strings when dialer values change
  useEffect(() => {
    setStartTime(`${pad(startHour)}:${pad(startMin)}`);
  }, [startHour, startMin]);
  
  useEffect(() => {
    setEndTime(`${pad(endHour)}:${pad(endMin)}`);
  }, [endHour, endMin]);
  
  // Handle hour selection - auto-apply minute=0 if no minute selected
  const handleStartHourChange = (hour: number) => {
    setStartHour(hour);
    if (startMin === undefined || isNaN(startMin)) {
      setStartMin(0);
    }
  };
  
  const handleEndHourChange = (hour: number) => {
    setEndHour(hour);
    if (endMin === undefined || isNaN(endMin)) {
      setEndMin(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    // Ensure minutes are always defined (default to 0)
    const finalStartMin = startMin ?? 0;
    const finalEndMin = endMin ?? 0;
    const finalStartHour = startHour ?? 9;
    const finalEndHour = endHour ?? 10;

    // Format times using pad helper - always HH:mm format
    const formattedStartTime = `${pad(finalStartHour)}:${pad(finalStartMin)}`;
    const formattedEndTime = `${pad(finalEndHour)}:${pad(finalEndMin)}`;

    const startMinutes = timeToMinutes(formattedStartTime);
    const endMinutes = timeToMinutes(formattedEndTime);

    if (endMinutes <= startMinutes) {
      alert('End time must be after start time');
      return;
    }

    // Ensure date is YYYY-MM-DD format
    const dateStr = date.split('T')[0]; // Remove time if present

    const event: CalendarEvent = {
      id: existingEvent?.id || `event-${Date.now()}-${Math.random()}`,
      title: title.trim(),
      date: dateStr,
      startTime: formattedStartTime, // Always in HH:mm format
      endTime: formattedEndTime,       // Always in HH:mm format
      notes: notes.trim() || null,
      urgency,
    };

    onSave(event);
    handleClose();
  };

  const handleClose = () => {
    if (!existingEvent) {
      setTitle('');
      setNotes('');
      setStartHour(9);
      setStartMin(0);
      setEndHour(10);
      setEndMin(0);
      setStartTime('09:00');
      setEndTime('10:00');
      setUrgency('medium');
    }
    onClose();
  };

  const handleDelete = () => {
    if (existingEvent && onDelete) {
      if (window.confirm('Are you sure you want to delete this event?')) {
        onDelete(existingEvent.id);
        handleClose();
      }
    }
  };

  if (!isOpen) return null;

  const urgencyLevels = [
    { value: 'low' as const, label: 'Low', emoji: '🔵' },
    { value: 'medium' as const, label: 'Medium', emoji: '🟡' },
    { value: 'critical' as const, label: 'Critical', emoji: '🟥' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-[28px] bg-[#05000b]/95 border border-[#ff0a45]/30 shadow-[0_0_30px_rgba(255,10,69,0.7)] p-6 md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold tracking-wide text-white">
            {existingEvent ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-[#ff0a45] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl bg-[#080712]/80 border border-white/5 focus-within:border-[#ff0a45]/60 focus-within:shadow-[0_0_14px_rgba(255,10,69,0.6)] px-3 py-2 text-sm text-white placeholder-neutral-500 transition-all"
              placeholder="Event title"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl bg-[#080712]/80 border border-white/5 focus-within:border-[#ff0a45]/60 focus-within:shadow-[0_0_14px_rgba(255,10,69,0.6)] px-3 py-2 text-sm text-white transition-all"
              required
            />
          </div>

          {/* Start Time Dialer */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-3">
              Start Time
            </label>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4 rounded-2xl bg-[#080712]/80 border border-[#ff0a45]/20 p-5">
                {/* Hour Column */}
                <div className="flex flex-col items-center w-16">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-neutral-500 mb-2">Hour</div>
                  <div 
                    className="flex flex-col gap-1 max-h-[200px] overflow-y-auto w-full"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 10, 69, 0.3) transparent'
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleStartHourChange(i)}
                        className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          startHour === i
                            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_12px_rgba(255,10,69,0.6)]'
                            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {pad(i)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="text-xl text-[#ff0a45] font-bold self-center">:</div>
                
                {/* Minute Column */}
                <div className="flex flex-col items-center w-16">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-neutral-500 mb-2">Min</div>
                  <div 
                    className="flex flex-col gap-1 max-h-[200px] overflow-y-auto w-full"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 10, 69, 0.3) transparent'
                    }}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setStartMin(m)}
                        className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          startMin === m
                            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_12px_rgba(255,10,69,0.6)]'
                            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* End Time Dialer */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-3">
              End Time
            </label>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4 rounded-2xl bg-[#080712]/80 border border-[#ff0a45]/20 p-5">
                {/* Hour Column */}
                <div className="flex flex-col items-center w-16">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-neutral-500 mb-2">Hour</div>
                  <div 
                    className="flex flex-col gap-1 max-h-[200px] overflow-y-auto w-full"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 10, 69, 0.3) transparent'
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleEndHourChange(i)}
                        className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          endHour === i
                            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_12px_rgba(255,10,69,0.6)]'
                            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {pad(i)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="text-xl text-[#ff0a45] font-bold self-center">:</div>
                
                {/* Minute Column */}
                <div className="flex flex-col items-center w-16">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-neutral-500 mb-2">Min</div>
                  <div 
                    className="flex flex-col gap-1 max-h-[200px] overflow-y-auto w-full"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 10, 69, 0.3) transparent'
                    }}
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEndMin(m)}
                        className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          endMin === m
                            ? 'bg-[#ff0a45]/20 text-[#ff0a45] border border-[#ff0a45]/60 shadow-[0_0_12px_rgba(255,10,69,0.6)]'
                            : 'text-neutral-400 hover:text-[#ff0a45] hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Urgency Level
            </label>
            <div className="flex gap-2">
              {urgencyLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgency(level.value)}
                  className={`flex-1 px-4 py-2 rounded-xl border transition-all font-medium text-sm ${
                    urgency === level.value
                      ? 'border-[#ff0a45]/60 bg-[#ff0a45]/20 text-[#ff0a45] shadow-[0_0_12px_rgba(255,10,69,0.6)]'
                      : 'border-white/10 bg-[#080712]/60 text-neutral-400 hover:border-[#ff0a45]/30 hover:text-[#ff0a45]'
                  }`}
                >
                  <span className="mr-2">{level.emoji}</span>
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">
              Description
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-2xl bg-[#080712]/80 border border-white/5 focus-within:border-[#ff0a45]/60 focus-within:shadow-[0_0_14px_rgba(255,10,69,0.6)] px-3 py-2 text-sm text-white placeholder-neutral-500 resize-none transition-all"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            {existingEvent && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:border-[#ff0a45]/60 hover:shadow-[0_0_12px_rgba(255,10,69,0.6)] transition-all font-medium text-sm"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-xl border border-white/10 bg-[#080712]/60 text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] hover:shadow-[0_0_15px_#ff0a45] transition-all font-medium text-sm"
            >
              {existingEvent ? 'Update' : 'Create'} Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

