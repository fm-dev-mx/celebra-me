/**
 * Structure contract per event type: sections every invitation of that type must include and the
 * theme presets with verified practice for it.
 *
 * Section variants stay type-agnostic: the canonical registry (`section-variants.ts`) owns them and
 * any registered variant may serve any event type. Field completeness for preparation lives in
 * `invitation-preparation/event-completeness-contracts.ts`.
 *
 * Every repository definition and demo is checked against this contract by
 * `tests/content/event-type-contract.test.ts`. Widening a list needs a definition or demo that uses
 * the new value plus its visual verification.
 */
import {
	listThemePresetsForEventType,
	type EventType,
	type InvitationRenderSectionKey,
	type ThemePreset,
} from '@/lib/theme/theme-contract';

export interface EventTypeStructureContract {
	eventType: EventType;
	/** Sections that must appear in `sectionOrder`. Hero is implicit and always first. */
	requiredSections: readonly InvitationRenderSectionKey[];
	/** Theme presets with a published invitation or demo of this type (`THEME_PRESET_METADATA`). */
	presets: readonly ThemePreset[];
	/** Edition wording printed by editorial variants (folios, press pass, catalog). */
	editionLabel: string;
	/** Short edition mark for serial codes and cover watermarks. */
	editionMark: string;
}

const CORE_SECTIONS = ['countdown', 'rsvp', 'thankYou'] as const;

const EVENT_TYPE_CONTRACTS: Record<EventType, Omit<EventTypeStructureContract, 'presets'>> = {
	xv: {
		eventType: 'xv',
		requiredSections: ['family', 'location', 'gallery', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN XV',
		editionMark: 'XV',
	},
	boda: {
		eventType: 'boda',
		requiredSections: ['family', 'location', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN BODA',
		editionMark: 'BODA',
	},
	cumple: {
		eventType: 'cumple',
		requiredSections: ['location', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN CUMPLEAÑOS',
		editionMark: 'CUMPLE',
	},
	bautizo: {
		eventType: 'bautizo',
		requiredSections: ['family', 'location', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN BAUTIZO',
		editionMark: 'BAUTIZO',
	},
	'baby-shower': {
		eventType: 'baby-shower',
		requiredSections: ['location', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN BABY SHOWER',
		editionMark: 'BABY SHOWER',
	},
	'primera-comunion': {
		eventType: 'primera-comunion',
		// Location may be revealed inside RSVP through its access policy instead of its own fold.
		requiredSections: ['family', ...CORE_SECTIONS],
		editionLabel: 'EDICIÓN PRIMERA COMUNIÓN',
		editionMark: 'COMUNIÓN',
	},
};

function getEventTypeStructureContract(eventType: EventType): EventTypeStructureContract {
	return { ...EVENT_TYPE_CONTRACTS[eventType], presets: listThemePresetsForEventType(eventType) };
}

/**
 * Edition wording of an event type for editorial variants. An unknown or missing type keeps the
 * XV edition, the editorial family's original issue.
 */
export function resolveEventEdition(eventType: string | undefined): {
	label: string;
	mark: string;
} {
	const contract =
		eventType && eventType in EVENT_TYPE_CONTRACTS
			? EVENT_TYPE_CONTRACTS[eventType as EventType]
			: EVENT_TYPE_CONTRACTS.xv;
	return { label: contract.editionLabel, mark: contract.editionMark };
}

export function listEventTypeStructureContracts(): EventTypeStructureContract[] {
	return Object.values(EVENT_TYPE_CONTRACTS).map((contract) =>
		getEventTypeStructureContract(contract.eventType),
	);
}

/** Contract violations for one invitation's canonical content; empty when it conforms. */
export function findEventTypeStructureViolations(content: {
	eventType: EventType;
	theme: { preset?: string };
	sectionOrder: readonly string[];
}): string[] {
	const contract = getEventTypeStructureContract(content.eventType);
	const violations: string[] = [];
	for (const section of contract.requiredSections) {
		if (!content.sectionOrder.includes(section)) {
			violations.push(`sectionOrder is missing required section "${section}"`);
		}
	}
	const preset = content.theme.preset;
	if (!preset) {
		violations.push('theme preset is missing');
	} else if (!(contract.presets as readonly string[]).includes(preset)) {
		violations.push(`theme preset "${preset}" is not verified for ${content.eventType}`);
	}
	return violations;
}
