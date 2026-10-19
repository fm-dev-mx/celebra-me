import fs from 'node:fs';
import path from 'node:path';

describe('Astro SSR dependency bundling', () => {
	it('externalizes sharp so Vite SSR does not break native image bindings', () => {
		const config = fs.readFileSync(path.resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
		expect(config).toMatch(/external:\s*\[['"]sharp['"]\]/);
	});
});
