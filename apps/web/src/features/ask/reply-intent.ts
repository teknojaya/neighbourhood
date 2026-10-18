import type { AskInput } from '@neighbourhood/shared';
/** Compatibility for historical text choices that actually describe a UI action. */
export function replyInput(text: string): AskInput | null {
  const value = text.trim().toLowerCase();
  if (/^(?:set|update|change|choose|edit)\b.*\b(?:location|profile)\b/.test(value)) return 'profile_location';
  if (/^enter custom (?:pickup|location) details[.!]?$/.test(value)) return 'listing_pickup';
  if (/^(?:add|take|upload|attach)(?: a)? photo[.!]?$/.test(value)) return 'photo';
  return null;
}
