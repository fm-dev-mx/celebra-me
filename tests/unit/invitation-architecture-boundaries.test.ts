import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

function readProjectFile(path: string): string {
	return readFileSync(join(repoRoot, path), 'utf8');
}

describe('invitation rendering architecture boundaries', () => {
	test('adapter view-model contracts do not depend on UI or intake workflow modules', () => {
		const adapterTypes = readProjectFile('src/lib/adapters/types.ts');

		expect(adapterTypes).not.toContain('@/components/invitation/rsvp-logic');
		expect(adapterTypes).not.toContain('@/lib/intake/types');
	});

	test('invitation UI imports render-safe helpers instead of intake workflow utilities', () => {
		const itineraryProgram = readProjectFile(
			'src/components/invitation/ItineraryProgram.astro',
		);
		const timelineList = readProjectFile('src/components/invitation/TimelineList.astro');

		expect(itineraryProgram).not.toContain('@/lib/intake/utils');
		expect(timelineList).not.toContain('@/lib/intake/utils');
	});
});
