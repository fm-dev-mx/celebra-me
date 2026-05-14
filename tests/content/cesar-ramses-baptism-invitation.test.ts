import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { collections } from '@/content.config';

const projectRoot = process.cwd();
const contentPath = path.join(projectRoot, 'src/content/events/cesar-ramses.json');
const demoContentPath = path.join(
	projectRoot,
	'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
);
const assetDir = path.join(projectRoot, 'src/assets/images/events/cesar-ramses');
const assetIndexPath = path.join(assetDir, 'index.ts');

const rawSchema = collections.events.schema;
if (!rawSchema) {
	throw new Error('events schema is not defined');
}
const eventSchema =
	typeof rawSchema === 'function' ? rawSchema({ image: () => z.string() } as never) : rawSchema;

type EventContent = z.infer<typeof eventSchema>;

function readCesarRamsesEvent(): EventContent {
	const raw = fs.readFileSync(contentPath, 'utf8');
	const parsed = JSON.parse(raw);
	const result = eventSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`Failed to parse event content: ${result.error}`);
	}
	return result.data;
}

describe('Cesar Ramses baptism invitation content', () => {
	it('uses a real routable baptism content file derived from the reusable demo contract', () => {
		const event = readCesarRamsesEvent();
		const result = eventSchema.safeParse(event);

		expect(result.success).toBe(true);
		expect(event).toMatchObject({
			eventType: 'bautizo',
			isDemo: false,
			title: 'Mi Bautizo y 1er Año de César Ramses',
			theme: { preset: 'angelic-presence' },
			hero: {
				name: 'César Ramses',
				label: 'Mi primer sacramento y un año de vida',
				date: '2026-06-20T22:00:00.000Z',
				backgroundImage: { type: 'internal', key: 'hero' },
			},
			rsvp: {
				accessMode: 'hybrid',
				confirmationMode: 'api',
				guestCap: 4,
			},
		});
	});

	it('contains the required reception and family content for a real baptism event', () => {
		const event = readCesarRamsesEvent();
		const content = fs.readFileSync(contentPath, 'utf8');

		expect(event.location?.reception).toMatchObject({
			venueName: 'Levanto Jardín de Eventos',
			time: '4:00 p.m.',
			image: { type: 'internal', key: 'reception' },
		});
		expect(event.family?.parents).toMatchObject({
			father: 'César Ramses Torres',
			mother: 'Sandra Heredia',
		});
		expect(event.family?.godparents).toEqual([
			{ name: 'Claudia Torres', role: 'Madrina' },
			{ name: 'Miguel Rodríguez', role: 'Padrino' },
		]);
		expect(content).toContain('César Ramses');
		expect(content).toContain('Guadalajara, Jalisco');
		expect(content).toContain('Mi Bautizo y 1er Año');
	});

	it('keeps the real invitation independent from the demo slug and asset module', () => {
		const content = fs.readFileSync(contentPath, 'utf8');
		const demoContent = fs.readFileSync(demoContentPath, 'utf8');
		const assetIndex = fs.readFileSync(assetIndexPath, 'utf8');

		expect(content).not.toContain('demo-bautismo-angelic-presence');
		expect(assetIndex).not.toContain('demo-bautismo-angelic-presence');
		expect(content).not.toContain('María Santos');
		expect(demoContent).toContain('María Santos');
	});

	it('configures slug-scoped local images for every visible baptism media surface', () => {
		const event = readCesarRamsesEvent();

		expect(event.family?.featuredImage).toEqual({ type: 'internal', key: 'family' });
		expect(event.sharing?.ogImage).toEqual({ type: 'internal', key: 'hero' });
		expect(event.gallery?.items?.map((item) => item.image)).toEqual([
			{ type: 'internal', key: 'gallery01' },
			{ type: 'internal', key: 'gallery02' },
			{ type: 'internal', key: 'gallery03' },
			{ type: 'internal', key: 'gallery04' },
			{ type: 'internal', key: 'gallery05' },
			{ type: 'internal', key: 'gallery06' },
		]);
		expect(event.interludes?.map((item) => item.image)).toEqual([
			{ type: 'internal', key: 'interlude01' },
			{ type: 'internal', key: 'interlude02' },
		]);
	});

	it('renders the requested baptism itinerary copy, times, and icons', () => {
		const event = readCesarRamsesEvent();

		expect(event.itinerary).toMatchObject({
			title: 'Programa',
			subtitle: 'Bautizo y 1er Año de César Ramses',
			items: [
				{
					icon: 'church',
					label: 'Santa Misa',
					time: '12:00 p.m.',
					description:
						'Nos reuniremos en familia para preparar el corazón antes de la celebración.',
				},
				{
					icon: 'map',
					label: 'Recepción',
					time: '4:00 p.m.',
					description:
						'Nos reuniremos para celebrar con cariño la vida y el bautizo de César Ramses.',
				},
				{
					icon: 'dinner',
					label: 'Comida',
					time: '5:30 p.m.',
					description:
						'Compartiremos la mesa en familia, con gratitud y alegría por este primer año.',
				},
				{
					icon: 'sparkles',
					label: 'Cierre',
					time: '10:00 p.m.',
					description:
						'Gracias por ser parte de este recuerdo que guardaremos con mucho amor.',
				},
			],
		});
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
			'hero.webp',
			'interlude-01.webp',
			'interlude-02.webp',
			'reception.webp',
			'thank-you.webp',
		]);

		for (const imageFile of imageFiles) {
			expect(source).toContain(`'./${imageFile}'`);
		}
	});

	it('has venue name and address present for the reception', () => {
		const event = readCesarRamsesEvent();

		expect(event.location?.venueName).toBe('Levanto Jardín de Eventos');
		expect(event.location?.address).toBe(
			'24 de Diciembre 45, La Tijera, 45645 Guadalajara, Jal.',
		);
		expect(event.location?.reception?.venueName).toBe('Levanto Jardín de Eventos');
	});

	it('has parents and godparents present with correct names', () => {
		const event = readCesarRamsesEvent();

		expect(event.family?.parents?.father).toBe('César Ramses Torres');
		expect(event.family?.parents?.mother).toBe('Sandra Heredia');
		expect(event.family?.godparents).toContainEqual({
			name: 'Claudia Torres',
			role: 'Madrina',
		});
		expect(event.family?.godparents).toContainEqual({
			name: 'Miguel Rodríguez',
			role: 'Padrino',
		});
	});

	it('has visible copy that includes "Mi Bautizo y 1er Año"', () => {
		const content = fs.readFileSync(contentPath, 'utf8');

		expect(content).toContain('Mi Bautizo y 1er Año');
	});
});
