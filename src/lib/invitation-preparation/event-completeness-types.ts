import type { EventType } from '@/lib/theme/theme-contract';

export const FIELD_REQUIREMENTS = ['required', 'conditional', 'recommended', 'optional'] as const;
export type FieldRequirement = (typeof FIELD_REQUIREMENTS)[number];

export const CONTRACT_MATURITIES = ['evidence-backed', 'partial', 'undefined'] as const;
export type ContractMaturity = (typeof CONTRACT_MATURITIES)[number];

export interface CompletenessFieldDefinition {
	id: string;
	label: string;
	requirement: FieldRequirement;
	/** Human-readable condition when requirement is conditional. */
	condition?: string;
	/**
	 * When true, unresolved missing/ambiguous/requires_owner_decision blocks
	 * READY_WITH_PLACEHOLDERS and READY_FOR_IMPLEMENTATION.
	 */
	blockingWhenUnresolved: boolean;
	/** Non-blocking fields may use a controlled [[PENDIENTE:...]] placeholder. */
	allowsPlaceholder: boolean;
	evidenceNotes?: string;
}

export interface EventTypeCompletenessContract {
	eventType: EventType;
	maturity: ContractMaturity;
	summary: string;
	gaps?: string[];
	fields: readonly CompletenessFieldDefinition[];
}
