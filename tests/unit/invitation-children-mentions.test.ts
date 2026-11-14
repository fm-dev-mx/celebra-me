import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Guest-facing invitation code mentions children only through formatParty/formatPassBreakdown,
// which stay silent when a pass has no child places. Fixed adults-only copy would reach every
// childless invitation, so it is not allowed in the invitation sources.
const ROOTS = ['src/components/invitation', 'src/lib/invitation'];
const ADULTS_ONLY_COPY = /solo\s+(para\s+)?adultos|sin\s+niños/i;

function listSources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return listSources(path);
		return /\.(astro|tsx?)$/.test(name) ? [path] : [];
	});
}

describe('children mentions in invitations', () => {
	it('keeps fixed adults-only copy out of the invitation sources', () => {
		const offenders = ROOTS.flatMap((root) => listSources(join(process.cwd(), root)))
			.filter((path) => ADULTS_ONLY_COPY.test(readFileSync(path, 'utf8')))
			.map((path) => relative(process.cwd(), path));
		expect(offenders).toEqual([]);
	});
});
