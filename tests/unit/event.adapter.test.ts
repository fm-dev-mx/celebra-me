import fs from 'node:fs';
import path from 'node:path';
import { adaptEvent } from '@/lib/adapters/event';

function loadEventFixture(slug: string) {
	const filePath = path.resolve(process.cwd(), 'src/content/events', `${slug}.json`);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('adaptEvent', () => {
	it('preserves family godparents in the invitation view model', () => {
		const event = {
			id: 'demo-xv',
			data: loadEventFixture('demo-xv'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toEqual([
			{ name: 'Sr. Juan Carlos', role: 'Padrino de Honor' },
			{ name: 'Sra. Ana María', role: 'Madrina de Honor' },
		]);
	});

	it('keeps godparents undefined when the event omits them', () => {
		const fixture = loadEventFixture('demo-xv');
		const event = {
			id: 'demo-xv',
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
});
