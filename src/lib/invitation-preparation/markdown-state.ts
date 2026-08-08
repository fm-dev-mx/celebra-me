import {
	evaluatePreparationReadiness,
	isPreparationReadiness,
	summarizeAssetQuality,
	type AssetPreparationSummary,
	type DesignDecisionSummary,
	type PreparationReadiness,
	type PreparationReadinessInput,
	type PreparationReadinessResult,
} from '@/lib/invitation-preparation/readiness';
import {
	isInfoClassification,
	type InfoClassification,
} from '@/lib/invitation-preparation/classification';
import {
	evaluateEventCompleteness,
	type PreparationFact,
} from '@/lib/invitation-preparation/event-completeness';
import {
	isImageQualityState,
	NON_PRODUCTION_IMAGE_STATES,
	type ImageQualityState,
} from '@/lib/invitation-preparation/image-optimization';
import {
	createPlaceholderToken,
	findPlaceholderTokens,
	type PlaceholderRecord,
} from '@/lib/invitation-preparation/placeholders';
import { isEventType, type EventType } from '@/lib/theme/theme-contract';

const READINESS_LINE =
	/\*\*Preparation Readiness(?:\s*\(prepReadiness\))?:\*\*\s*`?(NOT_READY|READY_WITH_PLACEHOLDERS|READY_FOR_IMPLEMENTATION)`?/i;

const FACT_ROW = /^\|\s*([a-z][a-zA-Z0-9_]*)\s*\|\s*([^|]*)\|\s*`?([^|]+?)`?\s*\|/u;

const EVENT_TYPE_ROW = /\|\s*\*\*Event Type\*\*\s*\|\s*`?([a-z0-9-]+)`?\s*\|/i;

/** Classification aliases seen in older Markdown — normalized to canonical InfoClassification. */
const CLASSIFICATION_ALIASES: Record<string, InfoClassification> = {
	'owner override': 'verified',
	'verified (adapted per owner)': 'verified',
	'verified + owner goal': 'verified',
	'verified (adapted)': 'verified',
};

/**
 * Extract preparation readiness from a canonical invitation Markdown document.
 */
export function parsePreparationReadinessFromMarkdown(
	markdown: string,
): PreparationReadiness | null {
	const match = markdown.match(READINESS_LINE);
	if (!match) return null;
	const value = match[1].toUpperCase();
	return isPreparationReadiness(value) ? value : null;
}

function parseEventTypeFromMarkdown(markdown: string): EventType | null {
	const match = markdown.match(EVENT_TYPE_ROW);
	if (!match) return null;
	const value = match[1].trim().toLowerCase();
	return isEventType(value) ? value : null;
}

export interface ParsedFactRow {
	fieldId: string;
	value: string;
	classification: InfoClassification;
}

function normalizeClassification(raw: string): InfoClassification | null {
	const trimmed = raw
		.trim()
		.toLowerCase()
		.replace(/^`+|`+$/g, '');
	if (isInfoClassification(trimmed)) return trimmed;
	const alias = CLASSIFICATION_ALIASES[trimmed];
	return alias ?? null;
}

/**
 * Parse fact-register table rows shaped like:
 * | fieldId | value | classification | source | notes |
 */
export function parseFactRegisterFromMarkdown(markdown: string): ParsedFactRow[] {
	const rows: ParsedFactRow[] = [];
	for (const line of markdown.split(/\r?\n/u)) {
		const match = line.match(FACT_ROW);
		if (!match) continue;
		const fieldId = match[1];
		const value = match[2].trim();
		const classification = normalizeClassification(match[3]);
		if (fieldId === 'field') continue;
		if (!classification) continue;
		rows.push({
			fieldId,
			value: value === '—' || value === '-' ? '' : value.replace(/^`+|`+$/g, ''),
			classification,
		});
	}
	return rows;
}

const PLACEHOLDER_ROW =
	/^\|\s*`?(\[\[PENDIENTE:[A-Z0-9_]+\]\])`?\s*\|\s*([^|]*)\|\s*(yes|no|true|false)\s*\|\s*([^|]*)\|\s*([^|]*)\|/iu;

/**
 * Parse Placeholders table rows:
 * | token | missing datum | blocking | reason | replacement requirement |
 */
function parsePlaceholderRecordsFromMarkdown(markdown: string): PlaceholderRecord[] {
	const records: PlaceholderRecord[] = [];
	for (const line of markdown.split(/\r?\n/u)) {
		const match = line.match(PLACEHOLDER_ROW);
		if (!match) continue;
		const token = match[1];
		const fieldRaw = match[2].trim();
		const blockingRaw = match[3].trim().toLowerCase();
		const blocking = blockingRaw === 'yes' || blockingRaw === 'true';
		const reason = match[4].trim();
		const replacementRequirement = match[5].trim();
		if (token.toLowerCase() === 'token') continue;
		const fieldId =
			fieldRaw && fieldRaw.toLowerCase() !== 'missing datum'
				? fieldRaw
				: token.replace(/^\[\[PENDIENTE:|\]\]$/g, '');
		records.push({
			token,
			fieldId,
			blocking,
			reason: reason || 'Documented placeholder',
			replacementRequirement:
				replacementRequirement || 'Replace with verified client content',
		});
	}

	if (records.length === 0) {
		for (const token of findPlaceholderTokens(markdown)) {
			records.push({
				token,
				fieldId: token.replace(/^\[\[PENDIENTE:|\]\]$/g, ''),
				blocking: false,
				reason: 'Token present in Markdown',
				replacementRequirement: 'Replace with verified content or omit',
			});
		}
	} else {
		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			try {
				if (createPlaceholderToken(record.fieldId) === record.token) continue;
			} catch {
				/* normalize from token */
			}
			records[i] = {
				...record,
				fieldId: record.token.replace(/^\[\[PENDIENTE:|\]\]$/g, ''),
			};
		}
	}
	return records;
}

function extractSection(markdown: string, headingPattern: RegExp): string {
	const lines = markdown.split(/\r?\n/u);
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (headingPattern.test(lines[i])) {
			start = i + 1;
			break;
		}
	}
	if (start < 0) return '';
	const out: string[] = [];
	for (let i = start; i < lines.length; i++) {
		if (/^##\s+/u.test(lines[i])) break;
		out.push(lines[i]);
	}
	return out.join('\n');
}

/**
 * Collect image quality states from Photograph Inventory tables and prose tokens.
 * Prefers the `quality` column in markdown tables so prose like "no production-ready
 * originals yet" does not falsely mark assets production-ready.
 */
export function parsePhotographInventoryQualitiesFromMarkdown(
	markdown: string,
): ImageQualityState[] {
	const section = extractSection(markdown, /^##\s+Photograph Inventory\b/iu);
	if (!section) return [];

	const fromTables: ImageQualityState[] = [];
	let qualityColumnIndex = -1;

	for (const line of section.split(/\r?\n/u)) {
		if (!/^\|/u.test(line) || /^\|\s*-+/u.test(line)) continue;
		const parts = line
			.split('|')
			.map((c) => c.trim())
			.filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));

		if (parts.some((p) => /^quality$/i.test(p))) {
			qualityColumnIndex = parts.findIndex((p) => /^quality$/i.test(p));
			continue;
		}
		if (qualityColumnIndex >= 0 && parts[qualityColumnIndex]) {
			const raw = parts[qualityColumnIndex].replace(/^`+|`+$/g, '').toLowerCase();
			if (isImageQualityState(raw)) fromTables.push(raw);
		}
	}

	if (fromTables.length > 0) return fromTables;

	const found: ImageQualityState[] = [];
	const tokenRe =
		/\b(production-ready|provisional-whatsapp|temporary-placeholder|missing|unusable)\b/giu;
	for (const match of section.matchAll(tokenRe)) {
		const state = match[1].toLowerCase();
		if (isImageQualityState(state)) found.push(state);
	}
	return found;
}

const UNIQUENESS_HEADING = /uniqueness\s+table|photo-role\s+map|final photo-role map/iu;

/**
 * True when a uniqueness / photo-role map table exists under Photograph Inventory (or nearby).
 */
export function hasUniquenessTableInMarkdown(markdown: string): boolean {
	const section = extractSection(markdown, /^##\s+Photograph Inventory\b/iu);
	const haystack = section || markdown;
	if (!UNIQUENESS_HEADING.test(haystack)) return false;
	const lines = haystack.split(/\r?\n/u);
	let seenHeading = false;
	for (const line of lines) {
		if (UNIQUENESS_HEADING.test(line)) {
			seenHeading = true;
			continue;
		}
		if (seenHeading && /^\|\s*[^|]+\|/u.test(line) && !/^\|\s*-+/u.test(line)) {
			const cells = line
				.split('|')
				.map((c) => c.trim())
				.filter(Boolean);
			if (cells[0]?.toLowerCase() === 'role') continue;
			if (cells.length >= 2 && cells[0] && cells[0] !== '—') return true;
		}
	}
	return false;
}

/** Accepts legacy "Client-selected demo" and owner-resolved "Owner-selected base demo". */
const DEMO_CLASS_ROW =
	/\|\s*(?:Client-selected demo|Owner-selected base demo)\s*\|\s*([^|]*)\|\s*`?([a-z_()+/\s.-]+)`?\s*\|/iu;

function parseDesignDecisionSummaryFromMarkdown(markdown: string): DesignDecisionSummary {
	const section = extractSection(markdown, /^##\s+Design Direction\b/iu);
	const match = (section || markdown).match(DEMO_CLASS_ROW);
	let demoClassification: InfoClassification = 'missing';
	if (match) {
		const raw = match[2].trim().toLowerCase();
		const base = raw.split(/\s+|\(/u)[0];
		if (isInfoClassification(base)) {
			demoClassification = base;
		} else if (raw.includes('verified')) {
			demoClassification = 'verified';
		} else if (raw.includes('requires_owner')) {
			demoClassification = 'requires_owner_decision';
		} else if (raw.includes('missing')) {
			demoClassification = 'missing';
		}
	}

	return {
		demoClassification,
		blockingUnresolvedDecisions: [],
	};
}

function buildAssetSummaryFromMarkdown(markdown: string): AssetPreparationSummary {
	const facts = parseFactRegisterFromMarkdown(markdown);
	const sourceFact = facts.find((f) => f.fieldId === 'sourceAssetPath');
	const sourcePathProvided = Boolean(
		sourceFact &&
		sourceFact.classification !== 'missing' &&
		(sourceFact.value.trim() || sourceFact.classification === 'verified'),
	);
	const qualities = parsePhotographInventoryQualitiesFromMarkdown(markdown);
	const inventoried =
		qualities.length > 0 ||
		/^##\s+Photograph Inventory\b/imu.test(markdown) ||
		hasUniquenessTableInMarkdown(markdown);
	const qualitySummary = summarizeAssetQuality(qualities);
	const blockingIssues: string[] = [];
	if (sourcePathProvided && inventoried && qualities.length === 0) {
		blockingIssues.push(
			'Photograph Inventory lacks recognizable quality states (production-ready / provisional-whatsapp / …).',
		);
	}
	return {
		sourcePathProvided,
		inventoried,
		hasAssignableImages: qualitySummary.hasAssignableImages,
		onlyNonProductionImages: qualitySummary.onlyNonProductionImages,
		blockingIssues,
	};
}

export interface DocumentedPreparationEvaluation {
	documentedReadiness: PreparationReadiness | null;
	eventType: EventType | null;
	helperResult: PreparationReadinessResult | null;
	input: PreparationReadinessInput | null;
	alignmentErrors: string[];
	hasUniquenessTable: boolean;
}

/**
 * Reconstruct helper inputs from Markdown and compare documented prepReadiness (A1/A2/A4/A6).
 */
export function evaluateDocumentedPreparationAlignment(
	markdown: string,
): DocumentedPreparationEvaluation {
	const documentedReadiness = parsePreparationReadinessFromMarkdown(markdown);
	const eventType = parseEventTypeFromMarkdown(markdown);
	const alignmentErrors: string[] = [];
	const hasUniqueness = hasUniquenessTableInMarkdown(markdown);

	if (!documentedReadiness) {
		alignmentErrors.push('Missing **Preparation Readiness:** line.');
		return {
			documentedReadiness: null,
			eventType,
			helperResult: null,
			input: null,
			alignmentErrors,
			hasUniquenessTable: hasUniqueness,
		};
	}
	if (!eventType) {
		alignmentErrors.push('Missing or invalid **Event Type** in Identity table.');
		return {
			documentedReadiness,
			eventType: null,
			helperResult: null,
			input: null,
			alignmentErrors,
			hasUniquenessTable: hasUniqueness,
		};
	}

	const facts: PreparationFact[] = parseFactRegisterFromMarkdown(markdown).map((row) => ({
		fieldId: row.fieldId,
		value: row.value,
		classification: row.classification,
	}));
	const completeness = evaluateEventCompleteness(eventType, facts);
	const placeholders = parsePlaceholderRecordsFromMarkdown(markdown);
	const assets = buildAssetSummaryFromMarkdown(markdown);
	const design = parseDesignDecisionSummaryFromMarkdown(markdown);
	const input: PreparationReadinessInput = {
		completeness,
		placeholders,
		assets,
		design,
	};
	const helperResult = evaluatePreparationReadiness(input);

	if (helperResult.readiness !== documentedReadiness) {
		alignmentErrors.push(
			`Documented prepReadiness is ${documentedReadiness} but evaluatePreparationReadiness yields ${helperResult.readiness}. Reasons: ${helperResult.reasons.join('; ')}`,
		);
	}

	const qualities = parsePhotographInventoryQualitiesFromMarkdown(markdown);
	const hasNonProductionAssigned = qualities.some((q) =>
		(NON_PRODUCTION_IMAGE_STATES as readonly string[]).includes(q),
	);

	if (
		documentedReadiness === 'READY_FOR_IMPLEMENTATION' &&
		(assets.onlyNonProductionImages || hasNonProductionAssigned)
	) {
		alignmentErrors.push(
			'A4: READY_FOR_IMPLEMENTATION is forbidden while inventory includes non-production quality states or onlyNonProductionImages is true.',
		);
	}

	if (
		(documentedReadiness === 'READY_WITH_PLACEHOLDERS' ||
			documentedReadiness === 'READY_FOR_IMPLEMENTATION') &&
		!hasUniqueness
	) {
		alignmentErrors.push(
			'A6: Uniqueness / photo-role map table is required before READY_WITH_PLACEHOLDERS or READY_FOR_IMPLEMENTATION.',
		);
	}

	return {
		documentedReadiness,
		eventType,
		helperResult,
		input,
		alignmentErrors,
		hasUniquenessTable: hasUniqueness,
	};
}
