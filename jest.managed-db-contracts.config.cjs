/** @type {import('ts-jest').JestConfigWithTsJest} */
const base = require('./jest.config.cjs');

/**
 * Jest config for disposable managed-lifecycle DB contracts (Goal 2 rekey).
 * Clears the no-DB ignore entry so the harness can execute these suites.
 */
module.exports = {
	...base,
	testPathIgnorePatterns: (base.testPathIgnorePatterns || []).filter(
		(pattern) => !pattern.includes('goal2-rekey-disposable-integration'),
	),
};
