import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';

const projectRoot = process.cwd();
const demoContentPath = path.join(
	projectRoot,
	'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
);

const rawSchema = collections['event-demos'].schema;
if (!rawSchema) {
	throw new Error('event-demos schema is not defined');
}
const eventSchema =
	typeof rawSchema === 'function' ? rawSchema({ image: () => z.string() } as never) : rawSchema;

type EventContent = z.infer<typeof eventSchema>;

function readDemoEvent(): EventContent {
	const raw = fs.readFileSync(demoContentPath, 'utf8');
	const parsed = JSON.parse(raw);
	const result = eventSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`Failed to parse event content: ${result.error}`);
	}
	return result.data;
}

describe('Baptism demo invitation content', () => {
	it('validates against the demo content schema', () => {
		const event = readDemoEvent();
		const result = eventSchema.safeParse(event);

		expect(result.success).toBe(true);
		expect(event).toMatchObject({
			eventType: 'bautizo',
			theme: { preset: 'angelic-presence' },
		});
	});

	it('contains required reception and family content', () => {
		const event = readDemoEvent();

		expect(event.location?.reception).toBeDefined();
		expect(event.family?.parents).toBeDefined();
		expect(event.family?.godparents).toBeDefined();
	});

	it('exports slug-scoped local images for every media surface', () => {
		const event = readDemoEvent();

		if (event.family?.featuredImage) {
			expect(event.family.featuredImage).toMatchObject({ type: 'internal' });
		}
		if (event.sharing?.ogImage) {
			expect(event.sharing.ogImage).toMatchObject({ type: 'internal' });
		}
		if (event.gallery?.items) {
			for (const item of event.gallery.items) {
				expect(item.image).toMatchObject({ type: 'internal' });
			}
		}
	});

	it('has navigation with RSVP as last entry', () => {
		const event = readDemoEvent();

		expect(Array.isArray(event.navigation)).toBe(true);
		if (event.navigation && event.navigation.length > 0) {
			expect(event.navigation[event.navigation.length - 1].href).toBe('#rsvp');
		}
	});

	it('configures valid itinerary structure when present', () => {
		const event = readDemoEvent();

		if (event.itinerary) {
			expect(event.itinerary.title).toBeTruthy();
			expect(Array.isArray(event.itinerary.items)).toBe(true);
		}
	});

	it('has a demo fixture with isDemo flag', () => {
		const event = readDemoEvent();

		expect(event.isDemo).toBe(true);
	});
});
