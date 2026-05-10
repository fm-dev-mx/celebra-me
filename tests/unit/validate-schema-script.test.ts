import { spawnSync } from 'node:child_process';

describe('validate-schema script', () => {
	it('treats documented base-style fallbacks as expected', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('Errors: 0');
		expect(result.stdout).toContain('Warnings: 0');
		expect(result.stdout).toMatch(/Expected base-style fallbacks: \d+/);
		expect(result.stdout).toContain(
			"location: Contract variant 'jewelry-box' intentionally uses base section styles",
		);
	});
});
