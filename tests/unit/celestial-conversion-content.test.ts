import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const demo = JSON.parse(read('src/invitations/demos/demo-xv-celestial-blue/content.json'));

it('opens on an arched night portrait with the split name repeated in the closing', () => {
	expect(demo.hero).toMatchObject({
		variant: 'framed-portrait',
		backgroundImage: 'portrait',
		presentation: { nameLeadWords: 1 },
	});
	expect(demo.thankYou.closingNameLeadWords).toBe(1);
	expect(demo.theme.motion).toBe('editorial');
});

it('speaks in her own warm voice instead of a borrowed quote', () => {
	expect(demo.quote.author).toBeUndefined();
	expect(demo.quote.closingLine).toMatch(/usted/);
	expect(JSON.stringify(demo)).not.toMatch(/Paulo Coelho/);
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
	expect(demo.family.labels).toMatchObject({ sectionTitle: 'Mi familia' });
	expect(demo.family.parents).toEqual({
		father: 'Alejandro Torres Mendoza',
		mother: 'Mariana Fernanda Rivas',
	});
	expect(demo.family.godparents).toEqual([
		{ name: 'Ricardo Torres Mendoza', role: 'Padrino' },
		{ name: 'Daniela Rivas Hernández', role: 'Madrina' },
		{ name: 'Fernando Castillo López', role: 'Padrino' },
	]);
	expect(read('src/invitations/demos/demo-xv-celestial-blue/assets.ts')).toContain(
		"import family from './assets/family-group.webp'",
	);
	expect(
		fs.existsSync(
			path.join(
				process.cwd(),
				'src/invitations/demos/demo-xv-celestial-blue/assets/family.webp',
			),
		),
	).toBe(true);
});

it('joins sections in a bridge, bridge, climax cadence and leaves every other boundary neutral', () => {
	expect(demo.composition.intersections).toEqual({
		quote: { family: 'atmospheric-blend', source: 'hero' },
		'interlude-after-family': { family: 'overlap', source: 'family' },
		gifts: { family: 'arch', source: 'gallery' },
	});
	const order = demo.sectionOrder;
	expect(order[order.indexOf('gifts') - 1]).toBe('gallery');
});

it('counts down right after the opening quote', () => {
	expect(demo.sectionOrder.slice(0, 2)).toEqual(['quote', 'countdown']);
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
		image: 'hero',
		afterSection: 'family',
		height: 'medium',
		presentation: 'framed',
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
	expect(images).not.toContain(demo.interludes[0].image);
	for (const item of demo.gallery.items) {
		expect(item.alt).toEqual(expect.stringMatching(/\S/));
		expect(item.caption).toEqual(expect.stringMatching(/\S/));
	}
	expect(demo.interludes).toHaveLength(1);
});
