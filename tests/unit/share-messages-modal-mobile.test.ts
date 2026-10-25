import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Share messages modal mobile cancel button', () => {
	it('defines visible 44px min-height cancel button with focus-ring and design tokens', () => {
		const scss = readFileSync(
			resolve(process.cwd(), 'src/styles/dashboard/_share-messages-modal.scss'),
			'utf8',
		);

		// Must not hide cancel button on mobile
		expect(scss).not.toMatch(/\.dashboard-modal__footer-cancel\s*\{\s*display:\s*none;?\s*\}/);

		// Must define inline-flex, 44px min-height, and focus-visible focus-ring
		expect(scss).toMatch(
			/\.dashboard-modal__footer-cancel\s*\{[^}]*min-height:\s*44px;[^}]*&:focus-visible\s*\{[^}]*@include\s+mixins\.focus-ring;?[^}]*\}/s,
		);
		expect(scss).toContain('border-radius: var(--radius-md, 10px);');
		expect(scss).toContain('font-size: var(--font-size-ui-btn, 0.9375rem);');
	});
});
