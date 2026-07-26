import fs from 'node:fs';
import path from 'node:path';

describe('Astro SSR dependency bundling', () => {
	it('keeps the complete sanitize-html runtime graph inside the server bundle', () => {
		const config = fs.readFileSync(path.resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
		const noExternalList = config.match(
			/noExternal:\s*isBuildCommand\s*\?\s*\[([\s\S]*?)\]\s*:\s*undefined/,
		)?.[1];

		expect(noExternalList).toBeDefined();
		for (const dependency of [
			'sanitize-html',
			'escape-string-regexp',
			'is-plain-object',
			'deepmerge',
			'parse-srcset',
			'postcss',
			'picocolors',
			'source-map-js',
			'nanoid',
			'launder',
			'dayjs',
			'htmlparser2',
			'entities',
			'domhandler',
			'domelementtype',
			'domutils',
			'dom-serializer',
		]) {
			expect(noExternalList).toContain(`'${dependency}'`);
		}
	});
});
