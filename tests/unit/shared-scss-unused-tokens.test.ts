import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared SCSS helpers stay only while something consumes them. Every global mixin must be
 * included somewhere under `src/`, and tokens removed for having no readers must not return.
 */

const projectRoot = process.cwd();
const MIXINS_FILE = 'src/styles/global/_mixins.scss';

function read(relativePath: string): string {
	return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function listSources(relativeDir: string): string[] {
	const entries = fs.readdirSync(path.join(projectRoot, relativeDir), { withFileTypes: true });
	return entries.flatMap((entry) => {
		const relativePath = path.posix.join(relativeDir, entry.name);
		if (entry.isDirectory()) return listSources(relativePath);
		return /\.(scss|astro)$/.test(entry.name) ? [relativePath] : [];
	});
}

describe('shared SCSS without consumers', () => {
	it('includes every global mixin at least once', () => {
		const mixins = [...read(MIXINS_FILE).matchAll(/^@mixin ([a-z0-9-]+)/gm)].map((m) => m[1]);
		const consumers = listSources('src').map(read).join('\n');

		const unused = mixins.filter(
			(name) => !new RegExp(`@include (?:[a-z-]+\\.)?${name}\\b`).test(consumers),
		);

		expect(mixins.length).toBeGreaterThan(0);
		expect(unused).toEqual([]);
	});

	it('keeps removed unused tokens out of the token layer', () => {
		expect(read(MIXINS_FILE)).not.toMatch(/@mixin typography\b/);
		expect(read('src/styles/tokens/_spacing.scss')).not.toMatch(
			/^\$spacing-(container-padding|section-gap):/m,
		);
		expect(read('src/styles/tokens/semantic/_color.scss')).not.toMatch(
			/--color-neutral-subtle:/,
		);
	});
});
