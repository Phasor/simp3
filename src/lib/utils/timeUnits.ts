/**
 * Time unit conversion utilities for chat access duration
 * Supports minutes, hours, and days for flexible pricing
 */

export type TimeUnit = 'minutes' | 'hours' | 'days';

/**
 * Get the display label for a time unit
 */
export function getTimeUnitLabel(unit: TimeUnit, plural: boolean = true): string {
  if (!plural) {
    return unit.slice(0, -1); // Remove trailing 's'
  }
  return unit;
}

/**
 * Get the short label for a time unit (e.g., "m", "h", "d")
 */
export function getTimeUnitShortLabel(unit: TimeUnit): string {
  switch (unit) {
    case 'minutes':
      return 'min';
    case 'hours':
      return 'hr';
    case 'days':
      return 'd';
  }
}

/**
 * Convert a time value to milliseconds
 * @param value - The time value
 * @param unit - The time unit
 * @returns Milliseconds
 */
export function timeValueToMilliseconds(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
  }
}

/**
 * Add time to a date
 * @param date - The base date
 * @param value - The time value to add
 * @param unit - The time unit
 * @returns New date with time added
 */
export function addTimeToDate(date: Date, value: number, unit: TimeUnit): Date {
  const newDate = new Date(date);
  const ms = timeValueToMilliseconds(value, unit);
  newDate.setTime(newDate.getTime() + ms);
  return newDate;
}

/**
 * Calculate time remaining between two dates
 * @param futureDate - The future date
 * @param currentDate - The current date (defaults to now)
 * @returns Object with time remaining in all units
 */
export function calculateTimeRemaining(
  futureDate: Date,
  currentDate: Date = new Date()
): {
  milliseconds: number;
  minutes: number;
  hours: number;
  days: number;
} {
  const diffMs = futureDate.getTime() - currentDate.getTime();
  
  if (diffMs <= 0) {
    return { milliseconds: 0, minutes: 0, hours: 0, days: 0 };
  }

  return {
    milliseconds: diffMs,
    minutes: Math.floor(diffMs / (60 * 1000)),
    hours: Math.floor(diffMs / (60 * 60 * 1000)),
    days: Math.floor(diffMs / (24 * 60 * 60 * 1000)),
  };
}

/**
 * Get minimum allowed time value for a given unit
 */
export function getMinTimeValue(unit: TimeUnit): number {
  return 1; // Always 1 for any unit
}

/**
 * Get maximum allowed time value for a given unit
 */
export function getMaxTimeValue(unit: TimeUnit): number {
  switch (unit) {
    case 'minutes':
      return 1440; // 24 hours
    case 'hours':
      return 720; // 30 days
    case 'days':
      return 365; // 1 year
  }
}

/**
 * Get recommended values for a time unit
 * These are useful defaults for dropdowns or suggestions
 */
export function getRecommendedTimeValues(unit: TimeUnit): number[] {
  switch (unit) {
    case 'minutes':
      return [1, 5, 10, 15, 30, 60, 120]; // Up to 2 hours
    case 'hours':
      return [1, 2, 6, 12, 24, 48, 72, 168]; // Up to 1 week
    case 'days':
      return [1, 3, 7, 14, 30, 60, 90, 180, 365]; // Up to 1 year
  }
}

/**
 * Format time remaining for display
 * Automatically chooses the most appropriate unit
 * @param timeRemaining - Time remaining object
 * @returns Formatted string like "5 days", "3 hours", or "45 minutes"
 */
export function formatTimeRemaining(timeRemaining: {
  milliseconds: number;
  minutes: number;
  hours: number;
  days: number;
}): string {
  if (timeRemaining.milliseconds <= 0) return 'Expired';

  // Choose the most appropriate unit
  if (timeRemaining.days >= 1) {
    const unit = getTimeUnitLabel('days', timeRemaining.days !== 1);
    return `${timeRemaining.days} ${unit}`;
  } else if (timeRemaining.hours >= 1) {
    const unit = getTimeUnitLabel('hours', timeRemaining.hours !== 1);
    return `${timeRemaining.hours} ${unit}`;
  } else {
    const unit = getTimeUnitLabel('minutes', timeRemaining.minutes !== 1);
    return `${timeRemaining.minutes} ${unit}`;
  }
}

/**
 * Format time remaining with breakdown (e.g., "2 days, 5 hours")
 * @param timeRemaining - Time remaining object
 * @returns Formatted string with breakdown
 */
export function formatTimeRemainingDetailed(timeRemaining: {
  milliseconds: number;
  minutes: number;
  hours: number;
  days: number;
}): string {
  if (timeRemaining.milliseconds <= 0) return 'Expired';

  const parts: string[] = [];

  if (timeRemaining.days > 0) {
    const unit = getTimeUnitLabel('days', timeRemaining.days !== 1);
    parts.push(`${timeRemaining.days} ${unit}`);
  }

  const remainingHours = timeRemaining.hours % 24;
  if (remainingHours > 0) {
    const unit = getTimeUnitLabel('hours', remainingHours !== 1);
    parts.push(`${remainingHours} ${unit}`);
  }

  const remainingMinutes = timeRemaining.minutes % 60;
  if (remainingMinutes > 0 && timeRemaining.days === 0) {
    const unit = getTimeUnitLabel('minutes', remainingMinutes !== 1);
    parts.push(`${remainingMinutes} ${unit}`);
  }

  return parts.slice(0, 2).join(', ') || 'Less than a minute';
}

/**
 * Format access duration for display (e.g., "30 days", "2 hours")
 * @param value - The time value
 * @param unit - The time unit
 * @returns Formatted string
 */
export function formatAccessDuration(value: number, unit: TimeUnit): string {
  const label = getTimeUnitLabel(unit, value !== 1);
  return `${value} ${label}`;
}

/**
 * Convert time from one unit to another
 * @param value - The time value
 * @param fromUnit - The source unit
 * @param toUnit - The target unit
 * @returns Converted value (may be fractional)
 */
export function convertTimeUnit(value: number, fromUnit: TimeUnit, toUnit: TimeUnit): number {
  if (fromUnit === toUnit) return value;
  
  // Convert to milliseconds first
  const ms = timeValueToMilliseconds(value, fromUnit);
  
  // Convert from milliseconds to target unit
  switch (toUnit) {
    case 'minutes':
      return ms / (60 * 1000);
    case 'hours':
      return ms / (60 * 60 * 1000);
    case 'days':
      return ms / (24 * 60 * 60 * 1000);
  }
}

/**
 * Get all available time units
 */
export function getAllTimeUnits(): TimeUnit[] {
  return ['minutes', 'hours', 'days'];
}

/**
 * Validate time unit string
 */
export function isValidTimeUnit(unit: string): unit is TimeUnit {
  return unit === 'minutes' || unit === 'hours' || unit === 'days';
}

/**
 * Get default time unit (days for backward compatibility)
 */
export function getDefaultTimeUnit(): TimeUnit {
  return 'days';
}

/**
 * Get suggested pricing ranges for different time units
 * Returns [minCents, maxCents] for the unit
 */
export function getSuggestedPriceRange(unit: TimeUnit): [number, number] {
  switch (unit) {
    case 'minutes':
      return [100, 5000]; // $1 - $50 for minutes
    case 'hours':
      return [500, 10000]; // $5 - $100 for hours
    case 'days':
      return [1000, 50000]; // $10 - $500 for days
  }
}
