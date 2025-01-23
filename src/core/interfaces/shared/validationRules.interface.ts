// src/core/interfaces/shared/validationRules.interface.ts

/**
 * Interface for an individual validation rule.
 */
export interface ValidationRule {
	validator: (value: string) => boolean;
	message: string;
}

/**
 * Type for the collection of validation rules for multiple fields.
 */
export type ValidationRules = Record<string, ValidationRule[]>;
