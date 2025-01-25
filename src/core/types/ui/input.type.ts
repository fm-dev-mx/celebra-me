// File: src/core/types/ui/input.type.ts

/**
 * Represents the valid input types for an HTML input element.
 * These types correspond to the standard `type` attribute for <input> elements.
 */
export type InputType =
	| 'text'
	| 'email'
	| 'password'
	| 'tel'
	| 'number'
	| 'url'
	| 'search'
	| 'date'
	| 'datetime-local'
	| 'month'
	| 'week'
	| 'time'
	| 'color';
