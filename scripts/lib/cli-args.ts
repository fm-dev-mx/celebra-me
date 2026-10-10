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
