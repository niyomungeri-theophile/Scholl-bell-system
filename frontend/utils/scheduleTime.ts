export function isOvernightTimeRange(startTime: string, endTime: string): boolean {
  return Boolean(startTime && endTime && endTime < startTime);
}
