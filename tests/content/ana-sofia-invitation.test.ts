import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';

const projectRoot = process.cwd();
const demoContentPath = path.join(
	projectRoot,
	'src/content/event-demos/xv/demo-xv-jewelry-box.json',
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

describe('XV demo invitation content', () => {
	it('validates against the demo content schema', () => {
		const event = readDemoEvent();
		const result = eventSchema.safeParse(event);

		expect(result.success).toBe(true);
		expect(event).toMatchObject({
			eventType: 'xv',
			theme: { preset: 'jewelry-box' },
		});
	});

	it('contains required sections for rendering', () => {
		const event = readDemoEvent();

		expect(event.hero).toBeDefined();
		expect(event.hero.name).toBeTruthy();
		expect(event.location).toBeDefined();
		expect(event.location.ceremony).toBeDefined();
		expect(event.sharing).toBeDefined();
	});

	it('exports slug-scoped local images for every media surface', () => {
		const event = readDemoEvent();

		expect(event.hero.backgroundImage).toMatchObject({ type: 'internal' });
		if (event.gallery?.items) {
			for (const item of event.gallery.items) {
				expect(item.image).toMatchObject({ type: 'internal' });
			}
		}
	});

	it('is a demo fixture with isDemo flag', () => {
		const event = readDemoEvent();

		expect(event.isDemo).toBe(true);
	});
});
