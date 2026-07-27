import fs from 'node:fs';
import path from 'node:path';

describe('Envelope Seal Tier Selection Contract', () => {
	const scssPath = path.resolve('src/styles/invitation/_envelope-reveal.scss');
	const scssContent = fs.readFileSync(scssPath, 'utf8');

	it('defines public envelope tier tokens scoped to .envelope-wrapper surface', () => {
		expect(scssContent).toContain('--env-seal-size-compact: 44px;');
		expect(scssContent).toContain('--env-seal-size-standard: 56px;');
		expect(scssContent).toContain('--env-seal-size-large: 68px;');
		// Ensure tokens are NOT attached to :root
		expect(scssContent).not.toMatch(/:root\s*\{[^}]*--env-seal-size-compact/);
	});

	it('uses container queries for discrete seal size tiers on .envelope-container', () => {
		expect(scssContent).toContain('container-type: inline-size;');
		expect(scssContent).toContain('--env-seal-size: var(--env-seal-size-compact);');
		expect(scssContent).toContain('@container (min-width: 360px)');
		expect(scssContent).toContain('--env-seal-size: var(--env-seal-size-standard);');
		expect(scssContent).toContain('@container (min-width: 480px)');
		expect(scssContent).toContain('--env-seal-size: var(--env-seal-size-large);');
	});

	it('does not contain fluid clamp formulas for seal size in envelope reveal SCSS', () => {
		const matches = scssContent.match(/--env-seal-size:\s*clamp\([^)]+\)/g);
		expect(matches).toBeNull();
	});

	it('unifies seal position at top: 50%; left: 50%; transform: translate(-50%, -50%);', () => {
		expect(scssContent).toContain('top: 50%;');
		expect(scssContent).toContain('left: 50%;');
		expect(scssContent).toContain('transform: translate(-50%, -50%);');
	});
});
