// src/core/types/validation/admittedValidationInput.type.ts

import { ContactFormFields } from '@/core/interfaces/forms/contactFormFields.interface';
import { EmailData } from '@interfaces/email/emailData.interface';

/**
 * Represents the acceptable input types for certain components or functions.
 * Combines complete or partial versions of `ContactFormData` and `EmailData`.
 */
export type AdmittedValidationInput =
	| ContactFormFields
	| Partial<ContactFormFields>
	| EmailData
	| Partial<EmailData>;
