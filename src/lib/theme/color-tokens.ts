/**
 * Content color role contract.
 *
 * These names let JSON/frontmatter point at approved semantic CSS color tokens
 * without becoming a second product color system.
 */
export const COLOR_TOKENS = [
	'surfacePrimary',
	'surfaceSecondary',
	'surfaceElevated',
	'surfaceDark',
	'actionPrimary',
	'actionAccent',
	'textPrimary',
	'textSecondary',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

function toKebabCase(token: ColorToken): string {
	return token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function resolveColorRole(token: ColorToken): string {
	return `var(--color-${toKebabCase(token)})`;
}
