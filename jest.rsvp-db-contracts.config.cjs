/** @type {import('ts-jest').JestConfigWithTsJest} */
const base = require('./jest.config.cjs');

/**
 * Jest config for disposable public RSVP DB/HTTP contracts.
 * Clears the no-DB ignore entries so the harness can execute these suites.
 */
module.exports = {
	...base,
	testPathIgnorePatterns: (base.testPathIgnorePatterns || []).filter(
		(pattern) =>
			!pattern.includes('public-guest-rsvp-db-boundary') &&
			!pattern.includes('public-rsvp-http-wiring-db'),
	),
};
