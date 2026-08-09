import fs from 'node:fs';
import path from 'node:path';

describe('Envelope Seal Proportional Sizing Contract', () => {
	const scssPath = path.resolve('src/styles/invitation/_envelope-reveal.scss');
	const scssContent = fs.readFileSync(scssPath, 'utf8');

	it('defines bounded proportional seal tokens on the envelope surface', () => {
		expect(scssContent).toContain('--env-seal-size-min: 40px;');
		expect(scssContent).toContain('--env-seal-size-max: 60px;');
		expect(scssContent).toContain('--env-seal-size-ratio: 10;');
		expect(scssContent).toContain('--env-seal-size: var(--env-seal-size-min);');
		expect(scssContent).not.toContain('--env-seal-size-compact');
		expect(scssContent).not.toContain('--env-seal-size-standard');
		expect(scssContent).not.toContain('--env-seal-size-large');
	});

	it('applies cqi sizing to the visual descendant of the query container', () => {
		expect(scssContent).toContain('container-type: inline-size;');
		expect(scssContent).toContain('@supports (width: 1cqi)');
		expect(scssContent).toContain('.envelope-container .envelope-seal-button__visual');
		expect(scssContent).toContain('calc(var(--env-seal-size-ratio) * 1cqi)');
	});

	it('keeps the visual size separate from the accessible button hit area', () => {
		expect(scssContent).toContain('min-width: 48px;');
		expect(scssContent).toContain('min-height: 48px;');
		expect(scssContent).toContain('width: var(--env-seal-size);');
		expect(scssContent).toContain('height: var(--env-seal-size);');
	});

	it('unifies seal position at top: 50%; left: 50%; transform: translate(-50%, -50%);', () => {
		expect(scssContent).toContain('top: 50%;');
		expect(scssContent).toContain('left: 50%;');
		expect(scssContent).toContain('transform: translate(-50%, -50%);');
	});
});
