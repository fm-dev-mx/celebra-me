import { PREMIUM_THEMES, type PremiumTheme } from './theme-variants';

export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Re-export everything from theme-variants
export * from './theme-variants';

// For backward compatibility
/**
 * @deprecated Use PREMIUM_THEMES instead
 */
export const THEME_PRESETS = [...PREMIUM_THEMES] as const;
export type ThemePreset = PremiumTheme;
