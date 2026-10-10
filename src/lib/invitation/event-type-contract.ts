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
import type {
	EventType,
	InvitationRenderSectionKey,
	ThemePreset,
} from '@/lib/theme/theme-contract';

export interface EventTypeStructureContract {
	eventType: EventType;
	/** Sections that must appear in `sectionOrder`. Hero is implicit and always first. */
	requiredSections: readonly InvitationRenderSectionKey[];
	/** Theme presets with a published invitation or demo of this type. */
	presets: readonly ThemePreset[];
}

const CORE_SECTIONS = ['countdown', 'rsvp', 'thankYou'] as const;

const EVENT_TYPE_CONTRACTS: Record<EventType, EventTypeStructureContract> = {
	xv: {
		eventType: 'xv',
		requiredSections: ['family', 'location', 'gallery', ...CORE_SECTIONS],
		presets: [
			'celestial-blue',
			'editorial',
			'editorial-magazine',
			'enchanted-rose',
			'jewelry-box',
			'premiere-floral',
		],
	},
	boda: {
		eventType: 'boda',
		requiredSections: ['family', 'location', ...CORE_SECTIONS],
		presets: ['jewelry-box-wedding'],
	},
	cumple: {
		eventType: 'cumple',
		requiredSections: ['location', ...CORE_SECTIONS],
		presets: ['editorial-magazine', 'luxury-hacienda'],
	},
	bautizo: {
		eventType: 'bautizo',
		requiredSections: ['family', 'location', ...CORE_SECTIONS],
		presets: ['angelic-presence', 'sacred-keepsake'],
	},
	'baby-shower': {
		eventType: 'baby-shower',
		requiredSections: ['location', ...CORE_SECTIONS],
		presets: ['celestial-blue'],
	},
	'primera-comunion': {
		eventType: 'primera-comunion',
		// Location may be revealed inside RSVP through its access policy instead of its own fold.
		requiredSections: ['family', ...CORE_SECTIONS],
		presets: ['angelic-presence'],
	},
};

export function getEventTypeStructureContract(eventType: EventType): EventTypeStructureContract {
	return EVENT_TYPE_CONTRACTS[eventType];
}

export function listEventTypeStructureContracts(): EventTypeStructureContract[] {
	return Object.values(EVENT_TYPE_CONTRACTS);
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
