import type { PremiumTheme } from './theme-variants';

export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// Re-export everything from theme-variants
export * from './theme-variants';

// Type alias for backward compatibility
export type ThemePreset = PremiumTheme;
