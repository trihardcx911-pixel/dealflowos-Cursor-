import React, { useState, useEffect } from 'react';
import { CalendarEvent, formatDate, minutesToTime, timeToMinutes } from './calendarUtils';
import { SimpleTimeEditor } from '../ui/SimpleTimeEditor';
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
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'critical'>('medium');

  // Internal state for time pickers - hybrid-controlled to prevent scroll resets
  const [internalStart, setInternalStart] = useState('09:00');
  const [internalEnd, setInternalEnd] = useState('10:00');

  useEffect(() => {
    if (!isOpen) return;
    
    if (existingEvent) {
      setTitle(existingEvent.title);
      setDate(existingEvent.date);
      const existingStart = existingEvent.startTime || '09:00';
      const existingEnd = existingEvent.endTime || '10:00';
      setInternalStart(existingStart);
      setInternalEnd(existingEnd);
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
        
        const computedStart = `${pad(sh)}:${pad(sm)}`;
        const computedEnd = `${pad(eh)}:${pad(em)}`;
        setInternalStart(computedStart);
        setInternalEnd(computedEnd);
      } else {
        setInternalStart('09:00');
        setInternalEnd('10:00');
      }
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    // Validate time format (should already be HH:mm from PreciseTimePicker)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(internalStart) || !timeRegex.test(internalEnd)) {
      alert('Please enter valid times in HH:mm format');
      return;
    }

    const startMinutes = timeToMinutes(internalStart);
    const endMinutes = timeToMinutes(internalEnd);

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
      startTime: internalStart,
      endTime: internalEnd,
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
      setInternalStart('09:00');
      setInternalEnd('10:00');
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
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-xl"
      style={{
        background: 'var(--bg-overlay)',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 mx-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 0 40px var(--neon-red-dim), inset 0 0 8px var(--glass-glow-inner)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {existingEvent ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={handleClose}
            className="transition-colors"
            style={{ 
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--neon-red)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm transition-all"
              style={{
                background: 'var(--glass-bg-dark)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
                e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              placeholder="Event title"
              autoFocus
              required
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 gap-3">
            {/* Date */}
            <div>
              <label className="block text-[0.65rem] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Date
              </label>
              
              {/* Date Input with Calendar Icon */}
              <div className="relative w-full">
                <input
                  id="dealflow-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-12 rounded-xl pl-3 pr-11 text-sm transition-all focus:outline-none"
                  style={{
                    background: 'var(--glass-bg-dark)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
                    e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  required
                />

                {/* Calendar Icon (Lucide) */}
                <div 
                  className="absolute inset-y-0 right-3 flex items-center cursor-pointer transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  onClick={() => {
                    const input = document.getElementById('dealflow-date-input') as HTMLInputElement;
                    input?.showPicker?.();
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8"  y1="2" x2="8"  y2="6"></line>
                    <line x1="3"  y1="10" x2="21" y2="10"></line>
                  </svg>
                </div>
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <SimpleTimeEditor
                value={internalStart}
                onChange={setInternalStart}
                label="Start Time"
              />
              <SimpleTimeEditor
                value={internalEnd}
                onChange={setInternalEnd}
                label="End Time"
              />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-[0.65rem] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Urgency
            </label>
            <div className="flex gap-2">
              {urgencyLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgency(level.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium"
                  style={
                    urgency === level.value
                      ? {
                          borderColor: 'var(--neon-red-soft)',
                          background: 'var(--neon-red-accent)',
                          color: 'var(--neon-red)',
                          boxShadow: '0 0 8px var(--neon-red-dim)',
                        }
                      : {
                          borderColor: 'var(--glass-border)',
                          background: 'var(--glass-bg-dark)',
                          color: 'var(--text-secondary)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (urgency !== level.value) {
                      e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
                      e.currentTarget.style.color = 'var(--neon-red)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (urgency !== level.value) {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <span className="mr-1.5">{level.emoji}</span>
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[0.65rem] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-xs resize-none transition-all"
              style={{
                background: 'var(--glass-bg-dark)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
                e.currentTarget.style.boxShadow = '0 0 10px var(--neon-red-dim)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {existingEvent && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg border transition-all text-xs font-medium"
                style={{
                  borderColor: 'var(--neon-red-soft)',
                  background: 'var(--neon-red-accent)',
                  color: 'var(--neon-red)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--neon-red-soft)';
                  e.currentTarget.style.boxShadow = '0 0 8px var(--neon-red-dim)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--neon-red-accent)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border transition-all text-xs font-medium"
              style={{
                borderColor: 'var(--glass-border)',
                background: 'var(--glass-bg-dark)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--neon-red-soft)';
                e.currentTarget.style.color = 'var(--neon-red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg transition-all text-xs font-medium"
              style={{
                background: 'var(--neon-red)',
                color: '#ffffff',
                boxShadow: '0 0 8px var(--neon-red-dim)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--neon-red-dark)';
                e.currentTarget.style.boxShadow = '0 0 12px var(--neon-red-dim)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--neon-red)';
                e.currentTarget.style.boxShadow = '0 0 8px var(--neon-red-dim)';
              }}
            >
              {existingEvent ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
