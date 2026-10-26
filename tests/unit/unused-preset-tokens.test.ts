import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

describe('Unused preset and ornament tokens hygiene (T346)', () => {
	it('removes unused tokens from sage-champagne while preserving active palette tokens', () => {
		const filePath = path.join(projectRoot, 'src/styles/themes/presets/_sage-champagne.scss');
		const content = fs.readFileSync(filePath, 'utf8');

		// Removed tokens:
		expect(content).not.toContain('--color-forest-dusk-rgb');
		expect(content).not.toContain('--color-warm-glow:');
		expect(content).not.toContain('--color-warm-glow-rgb:');

		// Preserved active tokens:
		expect(content).toContain('--color-forest-dusk:');
		expect(content).toContain('--color-forest-night:');
	});

	it('removes unused tokens from storybook-lilac while preserving active palette tokens', () => {
		const filePath = path.join(projectRoot, 'src/styles/themes/presets/_storybook-lilac.scss');
		const content = fs.readFileSync(filePath, 'utf8');

		// Removed token:
		expect(content).not.toContain('--color-violet-dusk-rgb');

		// Preserved active token:
		expect(content).toContain('--color-violet-dusk:');
		expect(content).toContain('--color-violet-night:');
	});

	it('removes unused storybook ornament motif tokens while preserving thread and light fields', () => {
		const filePath = path.join(
			projectRoot,
			'src/styles/invitation/_ornament-set-storybook-lanterns.scss',
		);
		const content = fs.readFileSync(filePath, 'utf8');

		// Removed motif tokens:
		expect(content).not.toContain('--ornament-motif-lantern');
		expect(content).not.toContain('--ornament-motif-tower');
		expect(content).not.toContain('--ornament-motif-sun:');
		expect(content).not.toContain('--ornament-motif-sprig');
		expect(content).not.toContain('--ornament-motif-sun-flower');
		expect(content).not.toContain('--ornament-motif-sparkle');

		// Preserved active tokens:
		expect(content).toContain('--ornament-foil:');
		expect(content).toContain('--ornament-thread-width:');
		expect(content).toContain('--ornament-lights-far:');
	});

	it('preserves fine-butterflies tokens consumed dynamically by butterfly spot mixins', () => {
		const filePath = path.join(
			projectRoot,
			'src/styles/invitation/_ornament-set-fine-butterflies.scss',
		);
		const content = fs.readFileSync(filePath, 'utf8');

		// All 27 spot tokens must remain present for dynamic consumption:
		expect(content).toContain('--ornament-ink:');
		expect(content).toContain('--ornament-butterfly-hero-a-display:');
		expect(content).toContain('--ornament-butterfly-hero-a-size:');
		expect(content).toContain('--ornament-butterfly-hero-a-top:');
		expect(content).toContain('--ornament-butterfly-hero-a-right:');
		expect(content).toContain('--ornament-butterfly-hero-a-transform:');
		expect(content).toContain('--ornament-butterfly-hero-b-display:');
		expect(content).toContain('--ornament-butterfly-hero-b-size:');
		expect(content).toContain('--ornament-butterfly-hero-b-top:');
		expect(content).toContain('--ornament-butterfly-hero-b-left:');
		expect(content).toContain('--ornament-butterfly-hero-b-transform:');
		expect(content).toContain('--ornament-butterfly-hero-b-delay:');
		expect(content).toContain('--ornament-butterfly-quote-display:');
		expect(content).toContain('--ornament-butterfly-quote-size:');
		expect(content).toContain('--ornament-butterfly-quote-top:');
		expect(content).toContain('--ornament-butterfly-quote-left:');
		expect(content).toContain('--ornament-butterfly-family-display:');
		expect(content).toContain('--ornament-butterfly-family-size:');
		expect(content).toContain('--ornament-butterfly-family-bottom:');
		expect(content).toContain('--ornament-butterfly-family-right:');
		expect(content).toContain('--ornament-butterfly-family-transform:');
		expect(content).toContain('--ornament-butterfly-family-delay:');
		expect(content).toContain('--ornament-butterfly-closing-display:');
		expect(content).toContain('--ornament-butterfly-closing-size:');
		expect(content).toContain('--ornament-butterfly-closing-top:');
		expect(content).toContain('--ornament-butterfly-closing-right:');
		expect(content).toContain('--ornament-butterfly-closing-transform:');
		expect(content).toContain('--ornament-butterfly-closing-delay:');
	});
});
