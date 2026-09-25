import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const demo = JSON.parse(read('src/content/event-demos/xv/demo-xv-celestial-blue.json'));
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
