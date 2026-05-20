import { spawnSync } from 'node:child_process';

describe('validate-schema script', () => {
	it('reports known baseline debt for preset isolation violations', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain('Errors: 18');
		expect(stdout).toContain('Warnings: 17');
		expect(stdout).toContain('Expected base-style fallbacks: 11');

		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box' intentionally uses base section styles",
		);
		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box-wedding' intentionally uses base section styles",
		);
	});

	it('correctly reports preset isolation violations in _celestial-blue.scss', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain('Preset _celestial-blue.scss:162 - CSS rule found: .family {');
	});

	it('correctly reports preset isolation violations in _sacred-keepsake.scss', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain(
			'Preset _sacred-keepsake.scss:406 - CSS rule found: .event-location__indication-item::after {',
		);
	});
});
