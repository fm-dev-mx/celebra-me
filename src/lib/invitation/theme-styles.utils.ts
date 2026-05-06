import type { ThemeConfig, EnvelopeViewModel } from '@/lib/adapters/types';

function escapeCssAttribute(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function generateThemeScopedStyles(
	theme: ThemeConfig,
	envelope: EnvelopeViewModel,
	eventSlug: string,
	isDemo: boolean,
): { dataAttributes: Record<string, string>; scopedStyles: string; showEnvelope: boolean } {
	const showEnvelope = envelope.enabled;
	const dataAttributes: Record<string, string> = {
		'data-theme-preset': theme.preset || 'base',
		'data-event-slug': eventSlug,
		'data-reveal-state': showEnvelope ? 'sealed' : 'revealed',
		'data-is-demo': isDemo ? 'true' : 'false',
	};

	const overrides: Record<string, string> = {};

	if (showEnvelope && envelope.data) {
		const { colors } = envelope.data;
		if (colors.background) {
			overrides['--env-bg'] = colors.background;
			overrides['--env-paper-bg'] = colors.background;
		}
		if (colors.primary) overrides['--env-text-primary'] = colors.primary;
		if (colors.accent) overrides['--env-accent'] = colors.accent;
	}

	const overrideStyles = Object.entries(overrides)
		.map(([key, value]) => `${key}: ${value};`)
		.join(' ');
	// The slug becomes part of an inline CSS attribute selector, so quote/backslash escape it.
	const scopedStyles = overrideStyles
		? `[data-event-slug="${escapeCssAttribute(eventSlug)}"] { ${overrideStyles} }`
		: '';

	return {
		dataAttributes,
		scopedStyles,
		showEnvelope,
	};
}
