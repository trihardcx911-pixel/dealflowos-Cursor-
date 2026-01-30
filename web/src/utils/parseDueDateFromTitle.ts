/**
 * Conservative parser for extracting due date/time from task titles
 * Returns cleaned title and ISO string for dueAt (or null if no date found)
 * 
 * Supported patterns:
 * - Relative: "today", "tomorrow", "tmr"
 * - Weekdays: "monday", "mon", etc. (next occurrence)
 * - Dates: "1/26", "1/26/2026", "jan 26", "january 26 2026", "feb 1st", "feb, 1", "feb 1, 2026"
 * - Times: "2pm", "2:30pm", "14:00" (with date, or time-only infers today/tomorrow)
 * 
 * If date parsed but no time, defaults to 9:00 AM local.
 * If time-only parsed (no date), infers today at that time (or tomorrow if time passed).
 * Examples:
 * - "Call Nick at 6:00PM" -> dueAt today 6:00 PM (or tomorrow if passed), cleanedTitle "Call Nick"
 * - "Text Rick at 7:19PM" -> dueAt today/tomorrow 7:19 PM, cleanedTitle "Text Rick"
 * - "Call Nick today 6:00PM" -> unchanged (date+time parsing)
 * - "Meeting tomorrow 2pm" -> unchanged (date+time parsing)
 */

interface ParseResult {
  cleanedTitle: string
  dueAtISO: string | null
}

export function parseDueDateFromTitle(rawTitle: string): ParseResult {
  const trimmed = rawTitle.trim()
  if (!trimmed) {
    return { cleanedTitle: trimmed, dueAtISO: null }
  }

  const now = new Date()
  const lowerTitle = trimmed.toLowerCase()
  let dueDate: Date | null = null
  let matchedText = ''
  let matchedTimeText = ''
  let matchedRelativeToday = false
  let timeExtractedFromTimeOnly = false

  // Pattern 1: Relative days ("today", "tomorrow", "tmr")
  const relativeMatch = lowerTitle.match(/\b(today|tomorrow|tmr)\b/)
  if (relativeMatch) {
    matchedText = relativeMatch[0]
    const isToday = relativeMatch[1] === 'today'
    matchedRelativeToday = isToday
    const dayOffset = isToday ? 0 : 1
    dueDate = new Date(now)
    dueDate.setDate(now.getDate() + dayOffset)
    dueDate.setHours(9, 0, 0, 0) // Default to 9 AM
  }

  // Pattern 2: Weekdays ("monday", "mon", etc.)
  if (!dueDate) {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const shortWeekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    
    for (let i = 0; i < weekdays.length; i++) {
      const fullPattern = new RegExp(`\\b(${weekdays[i]}|${shortWeekdays[i]})\\b`, 'i')
      const match = lowerTitle.match(fullPattern)
      if (match) {
        matchedText = match[0]
        const targetDay = i
        const currentDay = now.getDay()
        let daysAhead = targetDay - currentDay
        if (daysAhead <= 0) daysAhead += 7 // Next occurrence
        dueDate = new Date(now)
        dueDate.setDate(now.getDate() + daysAhead)
        dueDate.setHours(9, 0, 0, 0) // Default to 9 AM
        break
      }
    }
  }

  // Pattern 3: Explicit dates ("1/26", "1/26/2026", "jan 26", "jan 26 2026")
  if (!dueDate) {
    // M/D or M-D format
    const slashDateMatch = lowerTitle.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
    if (slashDateMatch) {
      matchedText = slashDateMatch[0]
      let month = parseInt(slashDateMatch[1], 10) - 1 // 0-indexed
      let day = parseInt(slashDateMatch[2], 10)
      let year = slashDateMatch[3] ? parseInt(slashDateMatch[3], 10) : now.getFullYear()
      
      // Handle 2-digit years
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year
      }
      
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        dueDate = new Date(year, month, day, 9, 0, 0, 0) // Default to 9 AM
        // If date is in the past, assume next year
        if (dueDate < now) {
          dueDate.setFullYear(year + 1)
        }
      }
    } else {
      // Month name format ("jan 26", "january 26 2026", "feb 1st", "feb, 1", "feb 1, 2026", "March 31 st", "Feb 12 th")
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      
      for (let i = 0; i < months.length; i++) {
        // Pattern supports: optional comma after month, day with optional ordinal suffix (with optional space), optional comma after day, optional year
        // Examples: "feb 1", "feb 1st", "feb 1 st", "feb, 1", "february 1, 2026", "feb 1st, 2026", "March 31 st 5pm", "Feb,12 th"
        const monthPattern = new RegExp(`\\b(${months[i]}|${shortMonths[i]})\\s*,?\\s*(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*,?\\s*(\\d{2,4})?\\b`, 'i')
        const match = lowerTitle.match(monthPattern)
        if (match) {
          matchedText = match[0]
          const month = i
          const day = parseInt(match[2], 10) // Extract day number (ignore ordinal suffix)
          let year = match[3] ? parseInt(match[3], 10) : now.getFullYear()
          
          if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year
          }
          
          if (day >= 1 && day <= 31) {
            dueDate = new Date(year, month, day, 9, 0, 0, 0) // Default to 9 AM
            // If date is in the past, assume next year (only for explicit dates without "today" keyword)
            if (dueDate < now) {
              dueDate.setFullYear(year + 1)
            }
          }
          break
        }
      }
    }
  }

  // Pattern 4: Time-only (if no date was parsed, infer today/tomorrow)
  if (!dueDate) {
    // Time patterns: "2pm", "2:30pm", "14:00", "at 2pm", "by 2pm"
    const timePatterns = [
      /\b(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
      /\b(?:at|by)?\s*(\d{1,2}):(\d{2})\b/,
    ]
    
    for (const pattern of timePatterns) {
      const timeMatch = lowerTitle.match(pattern)
      if (timeMatch) {
        matchedTimeText = timeMatch[0]
        let hours: number
        let minutes: number
        
        if (timeMatch[3]) {
          // 12-hour format with AM/PM
          hours = parseInt(timeMatch[1], 10)
          minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
          const isPM = timeMatch[3].toLowerCase() === 'pm'
          
          if (hours === 12) hours = 0
          if (isPM) hours += 12
        } else if (timeMatch[1] && timeMatch[2]) {
          // 24-hour format
          hours = parseInt(timeMatch[1], 10)
          minutes = parseInt(timeMatch[2], 10)
        } else {
          break // Invalid time match
        }
        
        // Validate hours and minutes
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          // Set dueDate to today at this time
          dueDate = new Date(now)
          dueDate.setHours(hours, minutes, 0, 0)
          
          // If time has passed today, set to tomorrow
          if (dueDate < now) {
            dueDate.setDate(dueDate.getDate() + 1)
          }
          
          // Mark that we extracted time from time-only pattern
          timeExtractedFromTimeOnly = true
        }
        break
      }
    }
  }

  // Extract time if present (only if we already have a date and didn't extract from time-only)
  if (dueDate && !timeExtractedFromTimeOnly) {
    // Time patterns: "2pm", "2:30pm", "14:00", "at 2pm", "by 2pm"
    const timePatterns = [
      /\b(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
      /\b(?:at|by)?\s*(\d{1,2}):(\d{2})\b/,
    ]
    
    for (const pattern of timePatterns) {
      const timeMatch = lowerTitle.match(pattern)
      if (timeMatch) {
        matchedTimeText = timeMatch[0]
        if (timeMatch[3]) {
          // 12-hour format with AM/PM
          let hours = parseInt(timeMatch[1], 10)
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
          const isPM = timeMatch[3].toLowerCase() === 'pm'
          
          if (hours === 12) hours = 0
          if (isPM) hours += 12
          
          dueDate.setHours(hours, minutes, 0, 0)
        } else if (timeMatch[1] && timeMatch[2]) {
          // 24-hour format
          const hours = parseInt(timeMatch[1], 10)
          const minutes = parseInt(timeMatch[2], 10)
          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            dueDate.setHours(hours, minutes, 0, 0)
          }
        }
        break
      }
    }
  }

  // Clean the title: remove matched text and clean up punctuation/spaces
  let cleanedTitle = trimmed
  if (dueDate) {
    // Remove matched date text (case-insensitive)
    if (matchedText) {
      const escaped = matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
      cleanedTitle = cleanedTitle.replace(regex, '')
    }
    
    // Remove matched time text (case-insensitive) - works for both date+time and time-only
    if (matchedTimeText) {
      const escaped = matchedTimeText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      cleanedTitle = cleanedTitle.replace(regex, '')
    }
    
    // Clean up extra spaces and punctuation
    cleanedTitle = cleanedTitle
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/^\s*[,\-–—]\s*|\s*[,\-–—]\s*$/g, '') // Leading/trailing commas/dashes
      .trim()
  }

  // Validate the date before returning
  if (dueDate && !isNaN(dueDate.getTime())) {
    // Special handling for "today" if default time has passed
    if (dueDate < now && matchedRelativeToday) {
      // Set to now + 1 hour (minimum future time)
      dueDate = new Date(now.getTime() + 60 * 60 * 1000)
      dueDate.setSeconds(0, 0) // Zero seconds and milliseconds
    }
    
    // Store dueAt only if date is in the future (or was adjusted to be)
    if (dueDate >= now) {
      return {
        cleanedTitle: cleanedTitle || trimmed, // Fallback to original if cleaned is empty
        dueAtISO: dueDate.toISOString(),
      }
    }
  }

  return {
    cleanedTitle: trimmed,
    dueAtISO: null,
  }
}

