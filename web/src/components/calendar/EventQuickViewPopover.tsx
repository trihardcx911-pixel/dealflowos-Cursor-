import React, { useEffect, useRef, useState } from 'react';
import { CalendarEvent, formatTimeForDisplay, parseDate } from './calendarUtils';
import { X, Edit2, Trash2 } from 'lucide-react';

interface EventQuickViewPopoverProps {
  event: CalendarEvent | null;
  anchorRect: DOMRect | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string | number) => void;
}

export const EventQuickViewPopover: React.FC<EventQuickViewPopoverProps> = ({
  event,
  anchorRect,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Calculate position based on anchorRect
  useEffect(() => {
    if (!isOpen || !anchorRect || !popoverRef.current) return;

    const popover = popoverRef.current;
    const popoverWidth = 280;
    const popoverHeight = 200;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default: position to the right of anchor
    let left = anchorRect.right + margin;
    let top = anchorRect.top;

    // If overflow right, flip to left
    if (left + popoverWidth > viewportWidth - margin) {
      left = anchorRect.left - popoverWidth - margin;
      // If still overflow, center over anchor
      if (left < margin) {
        left = anchorRect.left + (anchorRect.width / 2) - (popoverWidth / 2);
      }
    }

    // Clamp vertical position
    if (top + popoverHeight > viewportHeight - margin) {
      top = viewportHeight - popoverHeight - margin;
    }
    if (top < margin) {
      top = margin;
    }

    setPosition({ top, left });
  }, [isOpen, anchorRect]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Don't close if clicking on the anchor element (event block)
        if (anchorRect && e.target instanceof Element) {
          const targetRect = (e.target as Element).getBoundingClientRect();
          if (
            targetRect.left >= anchorRect.left &&
            targetRect.right <= anchorRect.right &&
            targetRect.top >= anchorRect.top &&
            targetRect.bottom <= anchorRect.bottom
          ) {
            return;
          }
        }
        onClose();
      }
    };

    // Use setTimeout to avoid immediate close on the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, anchorRect, onClose]);

  if (!isOpen || !event || !anchorRect) return null;

  // Format date + time range
  const dateObj = parseDate(event.date);
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateObj.getMonth()];
  const day = dateObj.getDate();
  
  const timeRange = event.startTime && event.endTime
    ? `${formatTimeForDisplay(event.startTime)} - ${formatTimeForDisplay(event.endTime)}`
    : event.startTime
    ? formatTimeForDisplay(event.startTime)
    : '';

  return (
    <div
      ref={popoverRef}
      className="fixed z-[10000] rounded-xl border backdrop-blur-xl shadow-[0_0_30px_rgba(255,10,69,0.25)]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '280px',
        background: 'var(--glass-bg)',
        borderColor: 'var(--neon-red-soft)',
        boxShadow: '0 0 40px var(--neon-red-dim), inset 0 0 8px var(--glass-glow-inner)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/10">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate mb-1">
            {event.title}
          </h3>
          <div className="text-xs text-white/60 space-y-0.5">
            <div>
              {dayName} {monthName} {day}
            </div>
            {timeRange && (
              <div className="font-mono">{timeRange}</div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description (if exists) */}
      {event.notes && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-white/70 line-clamp-3">{event.notes}</p>
        </div>
      )}

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="p-3 flex gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(event);
                onClose();
              }}
              className="flex-1 px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-2"
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
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this event?')) {
                  onDelete(event.id);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-lg border transition-all text-xs font-medium flex items-center justify-center gap-2"
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
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

