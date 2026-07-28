import {
	isPreparationReadiness,
	type PreparationReadiness,
} from '@/lib/invitation-preparation/readiness';
import {
	isInfoClassification,
	type InfoClassification,
} from '@/lib/invitation-preparation/classification';

const READINESS_LINE =
	/\*\*Preparation Readiness:\*\*\s*`?(NOT_READY|READY_WITH_PLACEHOLDERS|READY_FOR_IMPLEMENTATION)`?/i;

const FACT_ROW =
	/^\|\s*([a-z][a-zA-Z0-9_]*)\s*\|\s*([^|]*)\|\s*`?([a-z_]+)`?\s*\|/u;

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

export interface ParsedFactRow {
	fieldId: string;
	value: string;
	classification: InfoClassification;
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
		const classificationRaw = match[3].trim();
		if (fieldId === 'field') continue;
		if (!isInfoClassification(classificationRaw)) continue;
		rows.push({
			fieldId,
			value: value === '—' || value === '-' ? '' : value,
			classification: classificationRaw,
		});
	}
	return rows;
}
