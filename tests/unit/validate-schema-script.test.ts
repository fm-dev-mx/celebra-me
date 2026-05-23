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
		const warningsMatch = stdout.match(/Warnings: (\d+)/);
		expect(warningsMatch).not.toBeNull();
		const warningCount = Number(warningsMatch![1]);
		expect(warningCount).toBeGreaterThanOrEqual(10);
		expect(warningCount).toBeLessThan(30);

		expect(stdout).toContain('Expected base-style fallbacks:');

		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box' intentionally uses base section styles",
		);
		expect(stdout).toContain(
			"location: Contract variant 'jewelry-box-wedding' intentionally uses base section styles",
		);
	});
});
