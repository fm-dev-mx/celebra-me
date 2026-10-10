/**
 * Shared argv helpers for the operator CLIs. One definition instead of a copy per script, with one
 * rule: a flag's value is the next token unless that token is itself a flag.
 */

/** Value after `flag`, or undefined when the flag is absent or followed by another flag. */
export function flagValue(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	const value = args[index + 1];
	return value === undefined || value.startsWith('--') ? undefined : value;
}

export const ENVIRONMENT_TARGETS = ['local', 'preview', 'production'] as const;
export type EnvironmentTarget = (typeof ENVIRONMENT_TARGETS)[number];

/**
 * Parse a comma- or space-separated environment list. Returns the known targets once each, in
 * canonical order (local, preview, production); an unknown target throws.
 */
export function parseEnvironmentList(raw: string): EnvironmentTarget[] {
	const values = raw
		.split(/[,\s]+/)
		.map((value) => value.trim())
		.filter(Boolean);
	for (const value of values) {
		if (!(ENVIRONMENT_TARGETS as readonly string[]).includes(value)) {
			throw new Error(`Unknown target "${value}". Expected local,preview,production.`);
		}
	}
	return ENVIRONMENT_TARGETS.filter((target) => values.includes(target));
}
