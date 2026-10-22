import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { deriveStartsAtUtc } from '@/lib/time/event-time';
import { getFeaturedDemoShowroomItems } from '@/data/demo-showroom.data';
import demo from '@/invitations/demos/demo-xv-lantern-garden/invitation';
import { getDemoConversion, hasDemoConversion } from '@/lib/invitation/demo-conversion';

const content = eventContentSchema.parse(
	JSON.parse(
		fs.readFileSync(
			path.resolve('src/invitations/demos/demo-xv-lantern-garden/content.json'),
			'utf8',
		),
	),
);

describe('Lantern Garden review candidate', () => {
	it('keeps the unaccepted candidate outside the public showroom', () => {
		expect(demo.showroom.visibility).toBe('hidden');
		expect(demo.showroom.reviewStatus).toBe('needs-review');
		expect(getFeaturedDemoShowroomItems('xv').map((item) => item.slug)).not.toContain(
			demo.slug,
		);
		expect(content.isDemo).toBe(true);
		expect(hasDemoConversion(demo.slug, true)).toBe(false);
		expect(getDemoConversion(demo.slug)).toBeUndefined();
	});

	it('keeps the local evening, UTC countdown instant and visible calendar day coherent', () => {
		const timing = content.eventTiming!;
		expect(timing.startsAtUtc).toBe(deriveStartsAtUtc(timing.localDateTime, timing.timeZone));
		const calendarDay = new Intl.DateTimeFormat('en-CA', {
			timeZone: timing.timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(timing.startsAtUtc!));
		expect(calendarDay).toBe(content.hero.date.slice(0, 10));
		expect(
			new Intl.DateTimeFormat('es-MX', {
				timeZone: timing.timeZone,
				weekday: 'long',
			}).format(new Date(timing.startsAtUtc!)),
		).toBe('sábado');
	});

	it('does not navigate guests to invented venues or collect real confirmations', () => {
		expect(content.location?.introLede).toMatch(/celebración ficticia/i);
		for (const venue of content.location!.venues) {
			expect(venue.address).toContain('Espacio ilustrativo');
			expect(venue.googleMapsUrl).toBeUndefined();
			expect(venue.appleMapsUrl).toBeUndefined();
			expect(venue.mapUrl).toBeUndefined();
			expect(venue.wazeUrl).toBeUndefined();
		}
		expect(content.isDemo).toBe(true);
		expect(content.rsvp?.guestCap).toBe(4);
		expect(content.rsvp?.confirmationMessage).toContain('no registra asistencia');
	});
});
