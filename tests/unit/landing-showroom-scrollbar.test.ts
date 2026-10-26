import fs from 'node:fs';
import path from 'node:path';

import { compile } from 'sass';

/**
 * The landing showroom hides the scrollbar of its scrolling strips through the shared
 * `hide-scrollbar` mixin instead of repeating its declarations by hand.
 */
const SHOWROOM_SCSS = path.join(process.cwd(), 'src/styles/home/_landing-showroom.scss');

describe('landing showroom scrollbar', () => {
	const source = fs.readFileSync(SHOWROOM_SCSS, 'utf8');

	it('uses the shared mixin instead of hand-written declarations', () => {
		expect(source).not.toMatch(/scrollbar-width\s*:/u);
		expect(source).not.toMatch(/::-webkit-scrollbar/u);
		expect(source.match(/@include mixins\.hide-scrollbar;/gu)).toHaveLength(2);
	});

	it('still emits the hiding declarations for both strips', () => {
		const { css } = compile(SHOWROOM_SCSS);
		const rules = (pattern: RegExp) =>
			[...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)]
				.filter((m) => pattern.test(m[2]))
				.map((m) => m[1].trim());
		expect(rules(/scrollbar-width: none;/u)).toEqual(['.vitrina__events', '.vitrina__styles']);
		expect(rules(/display: none;/u)).toEqual(
			expect.arrayContaining([
				'.vitrina__events::-webkit-scrollbar',
				'.vitrina__styles::-webkit-scrollbar',
			]),
		);
	});
});
