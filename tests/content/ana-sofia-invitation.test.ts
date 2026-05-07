import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';

const projectRoot = process.cwd();
const contentPath = path.join(projectRoot, 'src/content/events/ana-sofia-cota-guillen.json');
const assetDir = path.join(projectRoot, 'src/assets/images/events/ana-sofia-cota-guillen');
const assetIndexPath = path.join(assetDir, 'index.ts');

const resolvedSchema =
	typeof collections.events.schema === 'function'
		? collections.events.schema({ image: () => z.unknown() } as unknown as never)
		: collections.events.schema;

if (!resolvedSchema) {
	throw new Error('events schema is not defined');
}

const eventSchema = resolvedSchema as {
	safeParse: (value: unknown) => { success: boolean; error?: unknown };
};

function readAnaSofiaEvent() {
	return JSON.parse(fs.readFileSync(contentPath, 'utf8')) as {
		eventType?: string;
		title?: string;
		theme?: { preset?: string; primaryColor?: string; accentColor?: string };
		hero?: { name?: string; date?: string; layoutVariant?: string };
		location?: {
			ceremony?: { venueName?: string; time?: string };
			reception?: { venueName?: string; time?: string };
			indications?: Array<{ icon?: string; iconName?: string; text?: string }>;
		};
		rsvp?: { accessMode?: string; confirmationMode?: string; guestCap?: number };
		music?: { url?: string };
	};
}

describe('Ana Sofia Cota Guillen invitation content', () => {
	it('uses an independent routable XV content file that satisfies the schema', () => {
		const event = readAnaSofiaEvent();
		const result = eventSchema.safeParse(event);

		expect(result.success).toBe(true);
		expect(event).toMatchObject({
			eventType: 'xv',
			title: 'XV Años de Ana Sofía',
			theme: { preset: 'jewelry-box' },
			hero: {
				name: 'Ana Sofía Cota Guillen',
				date: '2026-05-24T01:00:00.000Z',
				layoutVariant: 'premium-portrait',
			},
			rsvp: {
				accessMode: 'hybrid',
				confirmationMode: 'api',
				guestCap: 4,
			},
		});
		expect(event.theme?.primaryColor).toBeUndefined();
		expect(event.theme?.accentColor).toBeUndefined();
	});

	it('contains the required ceremony, reception, and dress-code content', () => {
		const event = readAnaSofiaEvent();
		const indicationText = event.location?.indications?.map((item) => item.text).join(' ');

		expect(event.location?.ceremony).toMatchObject({
			venueName: 'Parroquia de Nuestra Señora de Lourdes',
			time: '6:00 PM',
		});
		expect(event.location?.reception).toMatchObject({
			venueName: "Palapa Zavala's",
			time: '8:00 PM',
		});
		expect(event.location?.indications).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					icon: 'forbidden',
					iconName: 'Forbidden',
				}),
			]),
		);
		expect(indicationText).toContain('azul cielo');
	});

	it('keeps Ana Sofia independent from Ximena and avoids unlicensed music placeholders', () => {
		const content = fs.readFileSync(contentPath, 'utf8');

		expect(content).not.toMatch(/ximena-meza-trasvina|Ximena|premiere-floral/i);
		expect(content).not.toMatch(/Perfect|Ed Sheeran/i);
		expect(readAnaSofiaEvent().music).toBeUndefined();
	});

	it('exports all local optimized image files from the event asset module', () => {
		const source = fs.readFileSync(assetIndexPath, 'utf8');
		const imageFiles = fs
			.readdirSync(assetDir, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((name) => /\.(webp|png|jpe?g|svg)$/i.test(name));

		expect(imageFiles).toEqual([
			'family.webp',
			'gallery-01.webp',
			'gallery-02.webp',
			'gallery-03.webp',
			'gallery-04.webp',
			'gallery-05.webp',
			'gallery-06.webp',
			'gallery-07.webp',
			'gallery-08.webp',
			'gallery-09.webp',
			'gallery-10.webp',
			'hero.webp',
			'portrait.webp',
			'thank-you-portrait.webp',
		]);

		for (const imageFile of imageFiles) {
			expect(source).toContain(`'./${imageFile}'`);
		}
	});
});
