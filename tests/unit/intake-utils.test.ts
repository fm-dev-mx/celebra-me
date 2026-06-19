import { hasRsvpContent } from '@/lib/intake/utils';

describe('hasRsvpContent', () => {
	it('returns true when rsvp has a title', () => {
		expect(hasRsvpContent({ rsvp: { title: 'Confirmación' } })).toBe(true);
	});

	it('returns true when rsvp has a guestCap', () => {
		expect(hasRsvpContent({ rsvp: { guestCap: 10 } })).toBe(true);
	});

	it('returns false when rsvp is empty', () => {
		expect(hasRsvpContent({ rsvp: {} })).toBe(false);
	});

	it('returns false when content is undefined', () => {
		expect(hasRsvpContent(undefined)).toBe(false);
	});

	it('returns false when rsvp is missing', () => {
		expect(hasRsvpContent({})).toBe(false);
	});
});
