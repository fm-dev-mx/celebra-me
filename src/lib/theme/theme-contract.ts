import type { PremiumTheme } from './theme-variants';

export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Re-export everything from theme-variants
export * from './theme-variants';

export type ThemePreset = PremiumTheme;
