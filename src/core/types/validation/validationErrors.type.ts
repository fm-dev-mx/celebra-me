// File: src/core/types/validation/validationErrors.type.ts

/**
 * Represents a collection of validation errors for form fields.
 *
 * @template T - A union of field names (e.g., 'email' | 'password').
 * Each key represents a field, and its value is the corresponding error message.
 */
export type ValidationErrors<T extends string = never> = {
	[K in T]?: string;
};
