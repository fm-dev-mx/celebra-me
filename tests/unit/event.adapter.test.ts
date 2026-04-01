import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('adaptEvent', () => {
	it('preserves family godparents in the invitation view model', () => {
		const event = {
			id: 'event-demos/xv/demo-xv',
			data: loadFixture('src/content/event-demos/xv/demo-xv.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toEqual([
			{ name: 'Sr. Juan Carlos', role: 'Padrino de Honor' },
			{ name: 'Sra. Ana María', role: 'Madrina de Honor' },
		]);
	});

	it('keeps godparents undefined when the event omits them', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv.json');
		const event = {
			id: 'event-demos/xv/demo-xv',
			data: {
				...fixture,
				family: {
					...fixture.family,
					godparents: undefined,
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toBeUndefined();
	});

	it('resolves Ximena content blocks and reception-only venue data', () => {
		const event = {
			id: 'events/ximena-meza-trasvina',
			data: loadFixture('src/content/events/ximena-meza-trasvina.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('top-premium-floral');
		expect(viewModel.sections.location?.ceremony).toBeUndefined();
		expect(viewModel.sections.location?.reception?.venueName).toBe("D'Galaz Alberca y Eventos");
		expect(viewModel.contentBlocks?.[0]).toMatchObject({
			type: 'section',
			section: 'location',
		});
		expect(viewModel.contentBlocks?.[1]).toMatchObject({
			type: 'interlude',
			height: 'screen',
		});
		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
	});

	it('supports normalized object asset references from the schema layer', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv.json');
		const event = {
			id: 'event-demos/xv/demo-xv',
			data: {
				...fixture,
				hero: {
					...fixture.hero,
					backgroundImage: {
						type: 'internal',
						key: 'hero',
					},
					portrait: {
						type: 'external',
						src: '/images/custom-portrait.webp',
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
		expect(viewModel.hero.portrait?.src).toBe('/images/custom-portrait.webp');
	});

	it('normalizes legacy location indication icons when iconName is omitted', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv.json');
		const event = {
			id: 'event-demos/xv/demo-xv',
			data: {
				...fixture,
				location: {
					...fixture.location,
					indications: [
						{
							icon: 'crown',
							text: 'Reservado para familia',
						},
					],
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.location?.indications).toEqual([
			{
				iconName: 'Crown',
				styleVariant: 'default',
				text: 'Reservado para familia',
			},
		]);
	});

	it('preserves explicit interlude variants for editorial content blocks', () => {
		const event = {
			id: 'event-demos/xv/noir-premiere-xv',
			data: loadFixture('src/content/event-demos/xv/noir-premiere-xv.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('editorial');
		expect(viewModel.contentBlocks?.find((block) => block.type === 'interlude')).toMatchObject({
			type: 'interlude',
			variant: 'editorial',
		});
	});
});
