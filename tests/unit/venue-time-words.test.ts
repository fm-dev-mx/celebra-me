import { formatVenueTimeInWords } from '@/lib/invitation/venue-datetime';

describe('formatVenueTimeInWords', () => {
	it('writes whole hours with the day period', () => {
		expect(formatVenueTimeInWords('17:00')).toBe('a las cinco de la tarde');
		expect(formatVenueTimeInWords('19:00')).toBe('a las siete de la noche');
		expect(formatVenueTimeInWords('20:00')).toBe('a las ocho de la noche');
		expect(formatVenueTimeInWords('11:00')).toBe('a las once de la mañana');
	});

	it('uses the singular article for one o’clock', () => {
		expect(formatVenueTimeInWords('13:00')).toBe('a la una de la tarde');
		expect(formatVenueTimeInWords('01:30')).toBe('a la una y media de la noche');
	});

	it('accepts legacy prose and keeps quarters and halves', () => {
		expect(formatVenueTimeInWords('5:00 p. m.')).toBe('a las cinco de la tarde');
		expect(formatVenueTimeInWords('18:15')).toBe('a las seis y cuarto de la tarde');
	});

	it('falls back to the numeric display for other minutes', () => {
		expect(formatVenueTimeInWords('18:40')).not.toMatch(/^a las/);
	});
});
