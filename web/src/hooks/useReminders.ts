/**
 * useReminders Hook
 * 
 * Polls for due reminders and displays them as toasts.
 * Prevents duplicate notifications across multiple tabs using localStorage.
 */

import { useState, useEffect, useRef } from 'react';
import { get, patch } from '../api';

interface ReminderDTO {
  id: string;
  targetType: string;
  targetId: string;
  remindAt: string;
  sentAt: string | null;
  channel: string;
}

interface RemindersResponse {
  reminders: ReminderDTO[];
}

const POLL_INTERVAL = 60000; // 60 seconds
const SHOWN_REMINDERS_KEY = 'dfos_reminder_seen_v1';
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes (per Phase 4 requirements)

/**
 * Check if reminder has already been shown (localStorage coordination)
 */
function isReminderShown(reminderId: string): boolean {
  try {
    const shown = JSON.parse(localStorage.getItem(SHOWN_REMINDERS_KEY) || '{}');
    const timestamp = shown[reminderId];
    
    if (!timestamp) return false;
    
    // Check if still within TTL
    const age = Date.now() - timestamp;
    return age < DEDUP_TTL_MS;
  } catch (error) {
    console.error('[REMINDERS] Error checking shown status:', error);
    return false;
  }
}

/**
 * Mark reminder as shown in localStorage
 */
function markReminderShown(reminderId: string): void {
  try {
    const shown = JSON.parse(localStorage.getItem(SHOWN_REMINDERS_KEY) || '{}');
    shown[reminderId] = Date.now();
    
    // Cleanup old entries (> TTL)
    const cutoff = Date.now() - DEDUP_TTL_MS;
    Object.keys(shown).forEach(id => {
      if (shown[id] < cutoff) {
        delete shown[id];
      }
    });
    
    localStorage.setItem(SHOWN_REMINDERS_KEY, JSON.stringify(shown));
  } catch (error) {
    console.error('[REMINDERS] Error marking shown:', error);
  }
}

/**
 * Mark reminder as delivered on backend
 */
async function markReminderDelivered(reminderId: string): Promise<void> {
  try {
    await patch(`/reminders/${reminderId}/mark-delivered`, {});
  } catch (error) {
    console.error('[REMINDERS] Error marking delivered:', error);
  }
}

/**
 * Hook to poll for and display reminders
 */
export function useReminders(
  onReminderReceived?: (reminder: ReminderDTO) => void
) {
  const [reminders, setReminders] = useState<ReminderDTO[]>([]);
  const [lastFetch, setLastFetch] = useState<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Store callback in ref to avoid dependency issues
  const callbackRef = useRef(onReminderReceived);
  
  // Update callback ref when it changes (but don't restart polling)
  useEffect(() => {
    callbackRef.current = onReminderReceived;
  }, [onReminderReceived]);

  useEffect(() => {
    // Fetch reminders
    const fetchReminders = async () => {
      try {
        // Get browser timezone (IANA string) or default to UTC
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        
        // Fetch with timezone header
        const response = await get<RemindersResponse>('/reminders/due', {
          'x-timezone': timezone
        });
        const newReminders = response.reminders || [];
        
        setReminders(newReminders);
        setLastFetch(Date.now());
        
        // Process new reminders
        for (const reminder of newReminders) {
          // Skip if already shown
          if (isReminderShown(reminder.id)) {
            continue;
          }
          
          // Mark as shown immediately (before callback)
          markReminderShown(reminder.id);
          
          // Trigger callback using ref (always has latest callback)
          if (callbackRef.current) {
            callbackRef.current(reminder);
          }
          
          // Mark as delivered on backend (async, fire-and-forget)
          markReminderDelivered(reminder.id);
        }
      } catch (error) {
        console.error('[REMINDERS] Error fetching reminders:', error);
      }
    };

    // Fetch immediately on mount
    fetchReminders();

    // Then poll every 60 seconds
    intervalRef.current = setInterval(fetchReminders, POLL_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // Empty dependency array - run once on mount

  return {
    reminders,
    lastFetch
  };
}



