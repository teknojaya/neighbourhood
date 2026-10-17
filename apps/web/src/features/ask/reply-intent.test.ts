import { describe, expect, it } from 'vitest';
import { replyInput } from './reply-intent';
describe('historical Ask setup choices', () => {
  it('opens real controls for setup labels and leaves conversational answers as messages', () => {
    for (const text of ['Set location in Profile', 'Update Profile location']) expect(replyInput(text)).toBe('profile_location');
    expect(replyInput('Enter custom pickup details')).toBe('listing_pickup');
    expect(replyInput('Add a photo')).toBe('photo');
    for (const text of ['Use my saved Profile pickup location', 'Yes, add a description', 'Good', 'Continue without a photo for now.']) expect(replyInput(text)).toBeNull();
  });
});
