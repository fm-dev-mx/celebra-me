import { readFileSync } from 'node:fs';
import { itinerarySchema } from '@/lib/schemas/content/itinerary.schema';

const items = [
	{ iconName: 'Reception' as const, label: 'Recepción', time: '19:00' },
	{ iconName: 'Party' as const, label: 'Cierre', time: '00:00' },
];

const ribbonStyles = readFileSync('src/styles/invitation/scenes/_ribbon-route.scss', 'utf8');
const accentStyles = readFileSync('src/styles/invitation/_scroll-accents.scss', 'utf8');

describe('itinerary ribbon-route scene', () => {
	it('is accepted on the standard variant with two or more moments', () => {
		const result = itinerarySchema.safeParse({
			variant: 'standard',
			scene: 'ribbon-route',
			items,
		});
		expect(result.success).toBe(true);
	});

	it('is rejected on other variants', () => {
		const result = itinerarySchema.safeParse({
			variant: 'stacked-cards',
			scene: 'ribbon-route',
			items,
		});
		expect(result.success).toBe(false);
	});

	it('needs at least two moments to draw the ribbon between', () => {
		const result = itinerarySchema.safeParse({
			variant: 'standard',
			scene: 'ribbon-route',
			items: items.slice(0, 1),
		});
		expect(result.success).toBe(false);
	});

	it('moves only through the scene mixins, so the resting layout stays complete', () => {
		const animated = ribbonStyles.match(
			/^\s*(animation|clip-path|opacity|scale|rotate|translate):/gm,
		);
		// Every moving declaration sits inside `scene.timeline` / `scene.scripted` blocks or keyframes.
		const outsideScene = ribbonStyles
			.replace(/@include scene\.(timeline|scripted|pinned)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
			.replace(/@keyframes[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
		expect(animated?.length).toBeGreaterThan(0);
		expect(outsideScene).not.toMatch(
			/^\s*(animation|clip-path|opacity|scale|rotate|translate):/m,
		);
	});
});

describe('scroll accents', () => {
	it('run only for opted-in editorial profiles with motion allowed and scroll timelines', () => {
		expect(accentStyles).toContain('@supports (animation-timeline: view())');
		expect(accentStyles).toContain('@include a11y.motion-safe');
		expect(accentStyles).toContain('@container style(--scroll-accents: on)');
		expect(accentStyles).toContain("[data-motion='editorial']");
	});
});
