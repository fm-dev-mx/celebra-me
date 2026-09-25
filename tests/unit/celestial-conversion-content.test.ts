import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const demo = JSON.parse(read('src/content/event-demos/xv/demo-xv-celestial-blue.json'));

it('keeps the family portrait complete and the approved open composition scoped to this demo', () => {
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
	expect(read('src/assets/images/events/demo-xv-celestial-blue/index.ts')).toContain(
		"import family from './family-group.webp'",
	);
	expect(
		fs.existsSync(
			path.join(process.cwd(), 'src/assets/images/events/demo-xv-celestial-blue/family.webp'),
		),
	).toBe(true);
	const sibling = JSON.parse(read('src/content/event-demos/xv/demo-xv-xareni-profile.json'));
	expect(sibling.family.featuredImage).toBeUndefined();
	expect(sibling.visualProfileId).not.toBe(demo.visualProfileId);
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
	expect(demo.interludes[0].afterSection).toBe('family');
	expect(read('src/components/invitation/CountdownTimer.astro')).not.toContain('Math.random');
});
it('places the access pass next to RSVP and marks unverified maps as illustrative', () => {
	const order = demo.sectionOrder;
	expect(order[order.indexOf('rsvp') - 1]).toBe('personalizedAccess');
	expect(demo.location.introLede).toBe('Ubicación ilustrativa de la demo');
	expect(JSON.stringify(demo)).not.toMatch(/maps\.app\.goo\.gl\/example/);
});

it('uses the approved gallery photograph exactly once at the end without restoring interludes', () => {
	const images = demo.gallery.items.map((item: { image: string }) => item.image);
	expect(images).toEqual([
		'gallery01',
		'gallery02',
		'gallery03',
		'gallery04',
		'gallery05',
		'gallery07',
		'gallery08',
		'gallery06',
	]);
	expect(new Set(images).size).toBe(8);
	expect(
		demo.gallery.items.find((item: { image: string }) => item.image === 'gallery07'),
	).toMatchObject({ focalPoint: 'center 38%', aspectRatio: '3 / 4' });
	expect(demo.interludes).toHaveLength(1);
});
