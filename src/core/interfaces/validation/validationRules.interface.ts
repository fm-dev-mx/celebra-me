// src/core/interfaces/validation/validationRules.interface.ts

/**
 * Interface for an individual validation rule.
 */
export interface ValidationRule {
	validator: (value: string) => boolean;
	message: string;
}
