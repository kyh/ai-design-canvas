/**
 * Generates a unique ID string.
 * Format: timestamp (13 digits) + random hex string (19 chars) = 32 chars total
 * This provides good uniqueness while being shorter than UUID v4.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const extraRandom = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}${extraRandom}`;
}
