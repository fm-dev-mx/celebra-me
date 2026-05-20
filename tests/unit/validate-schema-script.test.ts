import { spawnSync } from 'node:child_process';

describe('validate-schema script', () => {
	it('reports clean preset isolation state with zero errors', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain('Errors: 0');
		expect(stdout).toContain('Warnings: 17');
		expect(stdout).toContain('Expected base-style fallbacks: 11');

		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box' intentionally uses base section styles",
		);
		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box-wedding' intentionally uses base section styles",
		);
	});
});
