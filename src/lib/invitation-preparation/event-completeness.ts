import {
	type InfoClassification,
	isResolvedClassification,
} from '@/lib/invitation-preparation/classification';
import type { EventType } from '@/lib/theme/theme-contract';

export {
	FIELD_REQUIREMENTS,
	type FieldRequirement,
	CONTRACT_MATURITIES,
	type ContractMaturity,
	type CompletenessFieldDefinition,
	type EventTypeCompletenessContract,
} from './event-completeness-types';

export {
	getEventCompletenessContract,
	listEventCompletenessContracts,
} from './event-completeness-contracts';

import { getEventCompletenessContract } from './event-completeness-contracts';
import type {
	CompletenessFieldDefinition,
	ContractMaturity,
	FieldRequirement,
} from './event-completeness-types';

export interface PreparationFact {
	fieldId: string;
	value?: string | null;
	classification: InfoClassification;
	/** Explicit condition context, e.g. distinctVenues=true */
	context?: Record<string, boolean | string>;
	source?: string;
	notes?: string;
}

export interface FieldCompletenessResult {
	fieldId: string;
	label: string;
	requirement: FieldRequirement;
	classification: InfoClassification;
	resolved: boolean;
	blocking: boolean;
	allowsPlaceholder: boolean;
	status:
		| 'satisfied'
		| 'missing-blocking'
		| 'missing-non-blocking'
		| 'ambiguous'
		| 'requires-owner-decision'
		| 'skipped-condition-false'
		| 'not-applicable';
	message: string;
}

export interface CompletenessEvaluation {
	eventType: EventType;
	maturity: ContractMaturity;
	sufficientToPrepare: boolean;
	blockingGaps: FieldCompletenessResult[];
	nonBlockingGaps: FieldCompletenessResult[];
	fields: FieldCompletenessResult[];
	contractGaps: string[];
}

function factMap(facts: readonly PreparationFact[]): Map<string, PreparationFact> {
	const map = new Map<string, PreparationFact>();
	for (const fact of facts) {
		map.set(fact.fieldId, fact);
	}
	return map;
}

function conditionApplies(
	field: CompletenessFieldDefinition,
	facts: Map<string, PreparationFact>,
): boolean {
	if (field.requirement !== 'conditional') return true;
	if (field.id === 'receptionVenueName' || field.id === 'receptionVenueAddress') {
		const flag = facts.get('distinctVenues');
		if (!flag) return true;
		if (flag.classification === 'not_applicable') return false;
		const value = flag.value?.toLowerCase().trim();
		if (value === 'false' || value === 'no') return false;
		return true;
	}
	if (field.id === 'rsvpWhatsappPhone') {
		const mode = facts.get('rsvpConfirmationMode');
		if (!mode?.value) return true;
		const value = mode.value.toLowerCase().trim();
		return value === 'whatsapp' || value === 'both';
	}
	return true;
}

export function evaluateEventCompleteness(
	eventType: EventType,
	facts: readonly PreparationFact[],
): CompletenessEvaluation {
	const contract = getEventCompletenessContract(eventType);
	const factsById = factMap(facts);
	const fields: FieldCompletenessResult[] = [];

	for (const field of contract.fields) {
		if (!conditionApplies(field, factsById)) {
			fields.push({
				fieldId: field.id,
				label: field.label,
				requirement: field.requirement,
				classification: 'not_applicable',
				resolved: true,
				blocking: false,
				allowsPlaceholder: field.allowsPlaceholder,
				status: 'skipped-condition-false',
				message: `Condition not met (${field.condition ?? 'n/a'}); field skipped.`,
			});
			continue;
		}

		const fact = factsById.get(field.id);
		const classification = fact?.classification ?? 'missing';
		const resolved = isResolvedClassification(classification);
		const hasValue = Boolean(fact?.value && String(fact.value).trim());

		if (classification === 'not_applicable') {
			fields.push({
				fieldId: field.id,
				label: field.label,
				requirement: field.requirement,
				classification,
				resolved: true,
				blocking: false,
				allowsPlaceholder: field.allowsPlaceholder,
				status: 'not-applicable',
				message: 'Marked not applicable for this invitation.',
			});
			continue;
		}

		if (resolved && (hasValue || classification === 'inferred')) {
			fields.push({
				fieldId: field.id,
				label: field.label,
				requirement: field.requirement,
				classification,
				resolved: true,
				blocking: false,
				allowsPlaceholder: field.allowsPlaceholder,
				status: 'satisfied',
				message:
					classification === 'inferred'
						? 'Resolved as inferred — must not be presented as a client statement.'
						: 'Resolved.',
			});
			continue;
		}

		if (classification === 'ambiguous') {
			fields.push({
				fieldId: field.id,
				label: field.label,
				requirement: field.requirement,
				classification,
				resolved: false,
				blocking: field.blockingWhenUnresolved,
				allowsPlaceholder: field.allowsPlaceholder,
				status: 'ambiguous',
				message: 'Multiple interpretations require resolution.',
			});
			continue;
		}

		if (classification === 'requires_owner_decision') {
			fields.push({
				fieldId: field.id,
				label: field.label,
				requirement: field.requirement,
				classification,
				resolved: false,
				blocking: field.blockingWhenUnresolved,
				allowsPlaceholder: field.allowsPlaceholder,
				status: 'requires-owner-decision',
				message: 'Owner decision required; recommendation must not auto-apply.',
			});
			continue;
		}

		const blocking =
			field.blockingWhenUnresolved &&
			(field.requirement === 'required' || field.requirement === 'conditional');

		fields.push({
			fieldId: field.id,
			label: field.label,
			requirement: field.requirement,
			classification: 'missing',
			resolved: false,
			blocking,
			allowsPlaceholder: field.allowsPlaceholder,
			status: blocking ? 'missing-blocking' : 'missing-non-blocking',
			message: blocking
				? 'Blocking missing data for preparation readiness.'
				: 'Non-blocking gap; controlled placeholder may be used when allowed.',
		});
	}

	const blockingGaps = fields.filter((field) => !field.resolved && field.blocking);
	const nonBlockingGaps = fields.filter((field) => !field.resolved && !field.blocking);

	return {
		eventType,
		maturity: contract.maturity,
		sufficientToPrepare: blockingGaps.length === 0,
		blockingGaps,
		nonBlockingGaps,
		fields,
		contractGaps: contract.gaps ?? [],
	};
}
