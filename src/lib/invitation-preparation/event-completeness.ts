import type { EventType } from '@/lib/theme/theme-contract';
import {
	type InfoClassification,
	isResolvedClassification,
} from '@/lib/invitation-preparation/classification';

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

const XV_FIELDS: readonly CompletenessFieldDefinition[] = [
	{
		id: 'slug',
		label: 'Canonical invitation slug',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Creation contract identity requirement.',
	},
	{
		id: 'celebrantName',
		label: 'Celebrant full name',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake event-details required; verified across recent XV invites.',
	},
	{
		id: 'eventLabel',
		label: 'Event label / invitation title',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake event-details required field.',
	},
	{
		id: 'eventDate',
		label: 'Event date',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake + creation contract.',
	},
	{
		id: 'eventTime',
		label: 'Primary event start time',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Present on all audited XV invitations (ceremony or reception start).',
	},
	{
		id: 'timeZone',
		label: 'IANA time zone',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Creation contract; typically America/Mexico_City in practice.',
	},
	{
		id: 'baseDemoId',
		label: 'Base demo / editor preset selection',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes:
			'Creation contract + DEMO_PRESET_CATALOG. If client did not select, classification must be requires_owner_decision.',
	},
	{
		id: 'sourceAssetPath',
		label: 'Filesystem/repository path for source photographs',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Preparation contract: photos never come from WhatsApp as authoritative assets.',
	},
	{
		id: 'sectionOrder',
		label: 'Included sections and order',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Creation contract section inclusions/omissions.',
	},
	{
		id: 'primaryVenueName',
		label: 'Primary venue name (ceremony and/or shared venue)',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'All audited XV invites published with at least one named venue.',
	},
	{
		id: 'primaryVenueAddress',
		label: 'Primary venue address',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Required for guest navigation; present on audited XV invites.',
	},
	{
		id: 'rsvpConfirmationMode',
		label: 'RSVP confirmation mode',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake rsvp-config required select.',
	},
	{
		id: 'rsvpGuestCap',
		label: 'RSVP guest cap',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake rsvp-config required number.',
	},
	{
		id: 'fatherName',
		label: 'Father name',
		requirement: 'recommended',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
		evidenceNotes: 'Intake optional; present on recent XV practice when family section included.',
	},
	{
		id: 'motherName',
		label: 'Mother name',
		requirement: 'recommended',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
		evidenceNotes: 'Intake optional; present on recent XV practice when family section included.',
	},
	{
		id: 'godparents',
		label: 'Godparents',
		requirement: 'recommended',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
		evidenceNotes: 'Common XV practice; omit only when section explicitly excluded.',
	},
	{
		id: 'receptionVenueName',
		label: 'Reception venue name',
		requirement: 'conditional',
		condition: 'Required when ceremony and reception are distinct venues.',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Conditional on multi-venue itineraries (Abril, Romina).',
	},
	{
		id: 'receptionVenueAddress',
		label: 'Reception venue address',
		requirement: 'conditional',
		condition: 'Required when ceremony and reception are distinct venues.',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'ceremonyMapUrl',
		label: 'Ceremony / primary venue map URL',
		requirement: 'recommended',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
		evidenceNotes: 'Coordinates may be inferred; exact pin often needs owner confirmation.',
	},
	{
		id: 'dressCode',
		label: 'Dress code',
		requirement: 'optional',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
	},
	{
		id: 'gifts',
		label: 'Gift / registry information',
		requirement: 'optional',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
		evidenceNotes: 'May be intentionally omitted (Abril).',
	},
	{
		id: 'musicUrl',
		label: 'Playable music URL',
		requirement: 'optional',
		blockingWhenUnresolved: false,
		allowsPlaceholder: false,
		evidenceNotes:
			'If music section included, need a direct playable URL — not a Spotify page. Else mark not_applicable.',
	},
	{
		id: 'rsvpWhatsappPhone',
		label: 'RSVP WhatsApp phone',
		requirement: 'conditional',
		condition: 'Required when confirmationMode is whatsapp or both.',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'rsvpDeadline',
		label: 'RSVP deadline',
		requirement: 'optional',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
	},
	{
		id: 'specialMessages',
		label: 'Quote / thank-you / special messages',
		requirement: 'recommended',
		blockingWhenUnresolved: false,
		allowsPlaceholder: true,
	},
	{
		id: 'clientColors',
		label: 'Client-requested colors / palette',
		requirement: 'optional',
		blockingWhenUnresolved: false,
		allowsPlaceholder: false,
		evidenceNotes: 'Absence means agent may recommend; selection needs owner decision.',
	},
] as const;

const BODA_PARTIAL_FIELDS: readonly CompletenessFieldDefinition[] = [
	{
		id: 'slug',
		label: 'Canonical invitation slug',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'celebrantName',
		label: 'Primary name (partner A)',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'secondaryName',
		label: 'Secondary name (partner B / spouse)',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
		evidenceNotes: 'Intake exposes spouse/secondary for boda; wedding demos always pair names.',
	},
	{
		id: 'eventDate',
		label: 'Event date',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'baseDemoId',
		label: 'Base demo / editor preset selection',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'sourceAssetPath',
		label: 'Filesystem/repository path for source photographs',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'sectionOrder',
		label: 'Included sections and order',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'primaryVenueName',
		label: 'Primary venue name',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'primaryVenueAddress',
		label: 'Primary venue address',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
	{
		id: 'rsvpConfirmationMode',
		label: 'RSVP confirmation mode',
		requirement: 'required',
		blockingWhenUnresolved: true,
		allowsPlaceholder: false,
	},
] as const;

function undefinedContract(eventType: EventType): EventTypeCompletenessContract {
	return {
		eventType,
		maturity: 'undefined',
		summary:
			'Preparation completeness fields are not yet evidence-backed for this event type. Do not invent requirements; collect global identity fields and escalate gaps.',
		gaps: [
			'No verified multi-invitation practice sample was used to define a full field matrix.',
			'Use global creation-contract identity fields only until this contract is authored.',
		],
		fields: [
			{
				id: 'slug',
				label: 'Canonical invitation slug',
				requirement: 'required',
				blockingWhenUnresolved: true,
				allowsPlaceholder: false,
			},
			{
				id: 'celebrantName',
				label: 'Primary celebrant / host name',
				requirement: 'required',
				blockingWhenUnresolved: true,
				allowsPlaceholder: false,
			},
			{
				id: 'eventDate',
				label: 'Event date',
				requirement: 'required',
				blockingWhenUnresolved: true,
				allowsPlaceholder: false,
			},
			{
				id: 'baseDemoId',
				label: 'Base demo / editor preset selection',
				requirement: 'required',
				blockingWhenUnresolved: true,
				allowsPlaceholder: false,
			},
			{
				id: 'sourceAssetPath',
				label: 'Filesystem/repository path for source photographs',
				requirement: 'required',
				blockingWhenUnresolved: true,
				allowsPlaceholder: false,
			},
		],
	};
}

const CONTRACTS: Record<EventType, EventTypeCompletenessContract> = {
	xv: {
		eventType: 'xv',
		maturity: 'evidence-backed',
		summary:
			'Evidence-backed from intake blocks, creation contract, and recent XV invitations (Valentina, Xareni, América, Romina, Abril).',
		fields: XV_FIELDS,
	},
	boda: {
		eventType: 'boda',
		maturity: 'partial',
		summary:
			'Partial contract from intake boda fields and wedding demo structure. Expand only with additional verified wedding invitation practice.',
		gaps: [
			'Family/godparent/itinerary requirement levels are under-evidenced relative to XV.',
			'Gift and music practices are not yet standardized for preparation completeness.',
		],
		fields: BODA_PARTIAL_FIELDS,
	},
	bautizo: undefinedContract('bautizo'),
	cumple: undefinedContract('cumple'),
	'baby-shower': undefinedContract('baby-shower'),
	'primera-comunion': undefinedContract('primera-comunion'),
};

export function getEventCompletenessContract(
	eventType: EventType,
): EventTypeCompletenessContract {
	return CONTRACTS[eventType];
}

export function listEventCompletenessContracts(): EventTypeCompletenessContract[] {
	return Object.values(CONTRACTS);
}

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
		if (flag.value === 'false' || flag.value === 'no') return false;
		return true;
	}
	if (field.id === 'rsvpWhatsappPhone') {
		const mode = facts.get('rsvpConfirmationMode');
		if (!mode?.value) return true;
		const value = mode.value.toLowerCase();
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
