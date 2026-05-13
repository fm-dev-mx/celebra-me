import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';

const projectRoot = process.cwd();
const contentPath = path.join(projectRoot, 'src/content/events/ana-sofia-cota-guillen.json');
const assetDir = path.join(projectRoot, 'src/assets/images/events/ana-sofia-cota-guillen');
const assetIndexPath = path.join(assetDir, 'index.ts');

const rawSchema = collections.events.schema;
if (!rawSchema) {
	throw new Error('events schema is not defined');
}
const eventSchema =
	typeof rawSchema === 'function' ? rawSchema({ image: () => z.string() } as never) : rawSchema;

type EventContent = z.infer<typeof eventSchema>;

function readAnaSofiaEvent(): EventContent {
	const raw = fs.readFileSync(contentPath, 'utf8');
	const parsed = JSON.parse(raw);
	const result = eventSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`Failed to parse event content: ${result.error}`);
	}
	return result.data;
}

describe('Ana Sofia Cota Guillen invitation content', () => {
	it('uses an independent routable XV content file that satisfies the schema', () => {
		const event = readAnaSofiaEvent();
		const result = eventSchema.safeParse(event);

		expect(result.success).toBe(true);
		expect(event).toMatchObject({
			eventType: 'xv',
			title: 'XV Años de Ana Sofía',
			theme: { preset: 'celestial-blue' },
			hero: {
				name: 'Ana Sofía Cota Guillen',
				date: '2026-05-23T07:00:00.000Z',
			},
			rsvp: {
				accessMode: 'hybrid',
				confirmationMode: 'api',
				guestCap: 4,
			},
		});
	});

	it('contains the required ceremony, reception, and dress-code content', () => {
		const event = readAnaSofiaEvent();
		const indicationText = event.location?.indications?.map((item) => item.text).join(' ');

		expect(event.location?.ceremony).toMatchObject({
			venueName: 'Nuestra Señora de Lourdes',
			time: '6:00 PM',
		});
		expect(event.location?.reception).toMatchObject({
			venueName: "Palapa Zavala's",
			time: '8:00 PM',
		});
		expect(event.location?.indications).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					icon: 'dressCode',
					iconName: 'DressCode',
				}),
			]),
		);
		expect(indicationText).toContain('azul cielo');
	});

	it('keeps Ana Sofia independent from other invitation themes and configures music intentionally', () => {
		const content = fs.readFileSync(contentPath, 'utf8');

		expect(content).not.toMatch(/ximena-meza-trasvina|Ximena|premiere-floral/i);
		expect(content).not.toMatch(/jewelry-box|jewelry-box-wedding|luxury-hacienda|editorial/i);
		expect(readAnaSofiaEvent().music).toMatchObject({
			url: expect.stringContaining('https://res.cloudinary.com/dusxvauvj/video/upload/'),
			autoPlay: true,
			title: 'Música de fondo',
		});
	});

	it('lists padrinos in the required paired order', () => {
		const event = readAnaSofiaEvent();

		expect(event.family?.godparents).toEqual([
			{ name: 'Sergio Pablo García Ramos', role: 'Padrino' },
			{ name: 'Dunelin Valdez Pacheco', role: 'Madrina' },
			{ name: 'Evelia Parra Torres', role: 'Madrina' },
			{ name: 'Miguel Armando Valencia Ochoa', role: 'Padrino' },
		]);
	});

	it('exports all local optimized image files from the event asset module', () => {
		const source = fs.readFileSync(assetIndexPath, 'utf8');
		const imageFiles = fs
			.readdirSync(assetDir, { withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((name) => /\.(webp|png|jpe?g|svg)$/i.test(name))
			.sort();

		expect(imageFiles).toEqual([
			'ceremony.webp',
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
			'interlude-01.webp',
			'interlude-02.webp',
			'interlude-03.webp',
			'interlude-04.webp',
			'portrait.webp',
			'reception.webp',
			'thank-you-portrait.webp',
		]);

		for (const imageFile of imageFiles) {
			expect(source).toContain(`'./${imageFile}'`);
		}
	});
});
