// jest.config.cjs

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: "ts-jest/presets/default-esm", // Use ESM preset
	testEnvironment: "node",
	extensionsToTreatAsEsm: [".ts", ".tsx"],
	transform: {
		"^.+\\.[tj]sx?$": [
			"ts-jest",
			{
				useESM: true,
			},
		],
	},
	moduleNameMapper: {
		// Updated aliases to match other configuration files
		"^@/(.*)$": "<rootDir>/src/$1",
		"^@components/(.*)$": "<rootDir>/src/frontend/components/$1",
		"^@utilities/(.*)$": "<rootDir>/src/core/utilities/$1",
		"^@layouts/(.*)$": "<rootDir>/src/frontend/layouts/$1",
		"^@images/(.*)$": "<rootDir>/src/frontend/assets/images/$1",
	},
	testMatch: ["**/tests/**/*.test.(ts|tsx)"],
};
