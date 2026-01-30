/**
 * Shared helper for tasks API response parsing
 * Ensures consistent extraction of tasks array from API responses
 */

export function extractTasksArray<T>(response: { tasks: T[] } | T[]): T[] {
  return Array.isArray(response) ? response : (response.tasks ?? [])
}







