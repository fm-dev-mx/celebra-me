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

	for (const [key, value] of Object.entries(theme.tokens)) {
		const kebabKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
		overrides[`--color-${kebabKey}-override`] = value;
	}

	for (const [key, value] of Object.entries(theme.colors)) {
		if (key.endsWith('Rgb')) {
			const baseName = key.replace(/Rgb$/, '');
			const kebabKey = baseName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
			overrides[`--color-${kebabKey}-rgb-override`] = value;
		}
	}

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
