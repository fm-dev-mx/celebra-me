import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const demo = JSON.parse(read('src/content/event-demos/xv/demo-xv-celestial-blue.json'));

it('uses the selected Paulo Coelho quote in Celestial Blue', () => {
	expect(demo.quote).toEqual({
		text: 'La posibilidad de realizar un sueño es lo que hace que la vida sea interesante.',
		author: 'Paulo Coelho',
	});
});

it('keeps the family portrait complete and the approved open composition scoped to this demo', () => {
	expect(demo.family.variant).toBe('standard');
	expect(demo.family.featuredImage).toEqual({
		type: 'internal',
		key: 'family',
		delivery: { mode: 'original', width: 1122, height: 1402 },
	});
	expect(demo.family.featuredImageAlt).toBe(
		'Retrato ilustrativo de Camila con vestido azul, acompañada de su madre y su padre.',
	);
	expect(demo.family.labels).toMatchObject({
		sectionTitle: 'Mi familia',
		sectionMessage: 'El cariño que me acompaña en cada paso.',
	});
	expect(demo.family.parents).toEqual({
		father: 'Alejandro Torres Mendoza',
		mother: 'Mariana Fernanda Rivas',
	});
	expect(demo.family.godparents).toEqual([
		{ name: 'Ricardo Torres Mendoza', role: 'Padrino' },
		{ name: 'Daniela Rivas Hernández', role: 'Madrina' },
		{ name: 'Fernando Castillo López', role: 'Padrino' },
	]);
	expect(demo.composition.intersections.family).toEqual({ family: 'arch', source: 'quote' });
	expect(demo.composition.intersections.quote).toEqual({
		family: 'atmospheric-blend',
		source: 'hero',
	});
	expect(read('src/assets/images/events/demo-xv-celestial-blue/index.ts')).toContain(
		"import family from './family-group.webp'",
	);
	expect(
		fs.existsSync(
			path.join(process.cwd(), 'src/assets/images/events/demo-xv-celestial-blue/family.webp'),
		),
	).toBe(true);
});

it('keeps the configured date, coherent identity and only the family interlude', () => {
	expect(demo.title).toContain('Camila Torres Rivas');
	expect(demo.envelope.sealInitials).toBe('C·T');
	expect(demo.eventTiming).toEqual({
		localDateTime: '2027-09-12T19:00',
		timeZone: 'America/Mexico_City',
		startsAtUtc: '2027-09-13T01:00:00.000Z',
	});
	expect(demo.interludes).toHaveLength(1);
	expect(demo.interludes[0]).toMatchObject({
		image: {
			type: 'internal',
			key: 'gallery05',
			delivery: { mode: 'original', width: 1080, height: 1350 },
		},
		afterSection: 'family',
		alt: 'Camila con vestido azul en un balcón al anochecer.',
		height: 'medium',
		focalPoint: '50% 30%',
		focalPointDesktop: '50% 12%',
	});
	expect(read('src/components/invitation/CountdownTimer.astro')).not.toContain('Math.random');
});
it('places the access pass next to RSVP and marks unverified maps as illustrative', () => {
	const order = demo.sectionOrder;
	expect(order[order.indexOf('rsvp') - 1]).toBe('personalizedAccess');
	expect(demo.location.introLede).toBe('Ubicación ilustrativa de la demo');
	expect(JSON.stringify(demo)).not.toMatch(/maps\.app\.goo\.gl\/example/);
});

it('preserves the curated gallery content golden with three photographs and the existing photo CTA', () => {
	const images = demo.gallery.items.map((item: { image: string }) => item.image);
	expect(demo.gallery.variant).toBe('feature-stack');
	// The existing last-item slot removes the final photograph from the grid and uses it in the CTA.
	expect(images).toEqual(['gallery04', 'gallery01', 'gallery02', 'gallery06']);
	expect(new Set(images).size).toBe(4);
	expect(images).not.toContain(demo.interludes[0].image.key);
	for (const item of demo.gallery.items) {
		expect(item.alt).toEqual(expect.stringMatching(/\S/));
		expect(item.caption).toEqual(expect.stringMatching(/\S/));
	}
	expect(demo.interludes).toHaveLength(1);
});
