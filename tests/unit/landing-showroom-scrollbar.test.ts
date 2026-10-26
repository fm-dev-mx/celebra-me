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
		expect(css.match(/scrollbar-width: none;/gu)).toHaveLength(2);
		expect(css.match(/::-webkit-scrollbar \{\s*display: none;\s*\}/gu)).toHaveLength(2);
	});
});
