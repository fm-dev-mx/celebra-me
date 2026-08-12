import { spawnSync } from 'node:child_process';

const KNOWN_BASE_STYLE_FALLBACKS = [
	"hero: Contract variant 'standard' intentionally uses base section styles",
	"family: Contract variant 'standard' intentionally uses base section styles",
	"location: Contract variant 'standard' intentionally uses base section styles",
	"gallery: Contract variant 'uniform-grid' intentionally uses base section styles",
	"gifts: Contract variant 'standard' intentionally uses base section styles",
	"rsvp: Contract variant 'standard' intentionally uses base section styles",
	"personalizedAccess: Contract variant 'standard' intentionally uses base section styles",
	"personalizedAccess: Contract variant 'ornamented' intentionally uses base section styles",
	"thankYou: Contract variant 'standard' intentionally uses base section styles",
];

describe('validate-schema script', () => {
	it('validates schema integrity with zero errors and expected warnings', () => {
		const result = spawnSync('node', ['scripts/validate-schema.mjs'], {
			cwd: process.cwd(),
			encoding: 'utf8',
			env: process.env,
		});

		const stdout = result.stdout;

		expect(stdout).toContain('Errors: 0');
		expect(stdout).toContain('Warnings: 0');
		expect(stdout).toContain(
			`Expected base-style fallbacks: ${KNOWN_BASE_STYLE_FALLBACKS.length}`,
		);

		for (const fallback of KNOWN_BASE_STYLE_FALLBACKS) {
			expect(stdout).toContain(fallback);
		}
	});
});
