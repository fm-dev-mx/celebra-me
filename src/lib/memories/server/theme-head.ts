/**
 * Puts a memory page in its invitation's theme: the preset's stylesheet in the
 * head and its class on the body, which defines the semantic color tokens the
 * status-page styles read. An unknown preset keeps the default look.
 */

import { resolvePresetCssUrl } from '@/lib/invitation/preset-css-resolver';
import type { ThemePreset } from '@/lib/theme/theme-contract';

export function resolveMemoriesThemeHead(preset: ThemePreset): {
	className: string;
	headLinks: Array<{ rel: 'stylesheet'; href: string }>;
} {
	try {
		return {
			className: `theme-preset--${preset} memories-guest-page`,
			headLinks: [{ rel: 'stylesheet', href: resolvePresetCssUrl(preset) }],
		};
	} catch {
		return { className: 'memories-guest-page', headLinks: [] };
	}
}
