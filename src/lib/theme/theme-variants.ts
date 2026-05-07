// ==========================================
// PREMIUM THEMES - Single source of truth
// ==========================================

export const PREMIUM_THEMES = [
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	'editorial',
	'premiere-floral',
	'celestial-blue',
] as const;

export type PremiumTheme = (typeof PREMIUM_THEMES)[number];

// ==========================================
// SPECIALIZED VARIANTS
// Logic-specific variants that don't depend on the general preset
// ==========================================

// Layout variants are a 1:1 subset of PREMIUM_THEMES.
// Each theme defines its own section layout. If a new theme is added to PREMIUM_THEMES
// and requires a custom hero or family layout, add it here too.
export const HERO_LAYOUT_VARIANTS = ['celestial-blue', 'premiere-floral'] as const;
export const FAMILY_LAYOUT_VARIANTS = ['celestial-blue', 'premiere-floral'] as const;

// Map styles (independent of event theme)
export const LOCATION_MAP_STYLES = ['dark', 'colorful', 'minimal', 'satellite'] as const;

// Typography and animation styles
export const QUOTE_ANIMATIONS = ['fade', 'bounce', 'elastic', 'none'] as const;
export const QUOTE_FONT_STYLES = ['serif', 'script', 'sans'] as const;
export const COUNTDOWN_NUMBER_STYLES = ['thin', 'bold', 'monospace'] as const;

// Indications and iconography
export const INDICATION_ICON_KEYS = [
	'crown',
	'envelope',
	'forbidden',
	'gift',
	'western-hat',
	'dressCode',
	'calendar',
] as const;

export const INDICATION_ICON_NAMES = [
	'Crown',
	'Envelope',
	'Forbidden',
	'Gift',
	'WesternHat',
	'Calendar',
	'DressCode',
] as const;

export const INDICATION_STYLE_VARIANTS = ['default', 'reserved'] as const;

// ==========================================
// DERIVED TYPES
// ==========================================

export type HeroLayoutVariant = (typeof HERO_LAYOUT_VARIANTS)[number];
export type FamilyLayoutVariant = (typeof FAMILY_LAYOUT_VARIANTS)[number];
export type LocationMapStyle = (typeof LOCATION_MAP_STYLES)[number];
export type QuoteAnimation = (typeof QUOTE_ANIMATIONS)[number];
export type QuoteFontStyle = (typeof QUOTE_FONT_STYLES)[number];
export type CountdownNumberStyle = (typeof COUNTDOWN_NUMBER_STYLES)[number];
export type IndicationIconKey = (typeof INDICATION_ICON_KEYS)[number];
export type IndicationIconName = (typeof INDICATION_ICON_NAMES)[number];
export type IndicationStyleVariant = (typeof INDICATION_STYLE_VARIANTS)[number];

// Legacy types - all sections now use PremiumTheme
export type QuoteVariant = PremiumTheme;
export type CountdownVariant = PremiumTheme;
export type LocationVariant = PremiumTheme;
export type SharedSectionVariant = PremiumTheme;
export type ItineraryVariant = PremiumTheme;
