// src/core/types/validation/validationRules.type.ts

import { ValidationRule } from '@/core/interfaces/validation/validationRules.interface';
/**
 * Type for the collection of validation rules for multiple fields.
 */
export type ValidationRules = Record<string, ValidationRule[]>;
