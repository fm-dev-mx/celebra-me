import type { FieldCompletenessResult } from '@/lib/invitation-preparation/event-completeness';
import type { InfoClassification } from '@/lib/invitation-preparation/classification';

export type OwnerDecisionCategory =
	| 'missing-client-facts'
	| 'ambiguous-data'
	| 'demo-design-decisions'
	| 'photograph-acceptance'
	| 'other-blocking';

export interface OwnerDecisionItem {
	id: string;
	category: OwnerDecisionCategory;
	issue: string;
	whyHumanInputRequired: string;
	evidence: string[];
	recommendation?: string;
	options?: string[];
}

export interface OwnerDecisionPack {
	title: string;
	summary: string;
	items: OwnerDecisionItem[];
	/** True when the pack can be presented as a single interaction round. */
	singleRound: true;
}

type DecisionInput = {
	id: string;
	issue: string;
	evidence: string[];
	recommendation?: string;
	options?: string[];
};

function categorizeBlockingGap(gap: FieldCompletenessResult): OwnerDecisionCategory {
	if (gap.status === 'ambiguous') return 'ambiguous-data';
	if (gap.status === 'requires-owner-decision') {
		if (gap.fieldId === 'baseDemoId' || gap.fieldId === 'clientColors') {
			return 'demo-design-decisions';
		}
		return 'other-blocking';
	}
	return 'missing-client-facts';
}

function whyForBlockingGap(gap: FieldCompletenessResult): string {
	if (gap.status === 'requires-owner-decision') {
		return 'This is a subjective or commercial choice that must not be inferred as a client decision.';
	}
	if (gap.status === 'ambiguous') {
		return 'Competing interpretations exist; choosing silently would invent client intent.';
	}
	return 'Required client information is missing from supplied materials.';
}

function itemsFromBlockingGaps(
	gaps: readonly FieldCompletenessResult[],
): OwnerDecisionItem[] {
	return gaps.map((gap) => ({
		id: gap.fieldId,
		category: categorizeBlockingGap(gap),
		issue: `${gap.label} is unresolved (${gap.status}).`,
		whyHumanInputRequired: whyForBlockingGap(gap),
		evidence: [gap.message],
	}));
}

function appendOptionalItems(
	items: OwnerDecisionItem[],
	category: OwnerDecisionCategory,
	entries: readonly DecisionInput[] | undefined,
	whyHumanInputRequired: string,
): void {
	for (const entry of entries ?? []) {
		items.push({
			id: entry.id,
			category,
			issue: entry.issue,
			whyHumanInputRequired,
			evidence: entry.evidence,
			recommendation: entry.recommendation,
			options: entry.options,
		});
	}
}

export function buildOwnerDecisionPack(input: {
	slug: string;
	blockingGaps: readonly FieldCompletenessResult[];
	nonBlockingGaps?: readonly FieldCompletenessResult[];
	designDecisions?: Array<
		DecisionInput & {
			classification: InfoClassification;
		}
	>;
	photographIssues?: DecisionInput[];
	otherBlocking?: DecisionInput[];
	includeNonBlockingInPack?: boolean;
}): OwnerDecisionPack {
	const items: OwnerDecisionItem[] = itemsFromBlockingGaps(input.blockingGaps);

	if (input.includeNonBlockingInPack) {
		for (const gap of input.nonBlockingGaps ?? []) {
			items.push({
				id: gap.fieldId,
				category: 'missing-client-facts',
				issue: `${gap.label} is a non-blocking gap (${gap.status}).`,
				whyHumanInputRequired:
					'Optional clarification avoids placeholder content reaching production later.',
				evidence: [gap.message],
			});
		}
	}

	const unresolvedDesign = (input.designDecisions ?? []).filter(
		(decision) =>
			decision.classification !== 'verified' &&
			decision.classification !== 'not_applicable' &&
			decision.classification !== 'inferred',
	);
	appendOptionalItems(
		items,
		'demo-design-decisions',
		unresolvedDesign,
		'Creative/demo choices require owner authorization; recommendations must not auto-apply.',
	);
	appendOptionalItems(
		items,
		'photograph-acceptance',
		input.photographIssues,
		'Photograph acceptance or replacement cannot be invented from conversation context.',
	);
	appendOptionalItems(
		items,
		'other-blocking',
		input.otherBlocking,
		'This decision blocks safe preparation or implementation.',
	);

	const byCategory = items.reduce<Record<string, number>>((acc, item) => {
		acc[item.category] = (acc[item.category] ?? 0) + 1;
		return acc;
	}, {});
	const summaryParts = Object.entries(byCategory).map(
		([category, count]) => `${count} ${category}`,
	);

	return {
		title: `Owner decision pack — ${input.slug}`,
		summary:
			items.length === 0
				? 'No unresolved owner decisions remain.'
				: `Consolidated single-round pack: ${summaryParts.join(', ')}.`,
		items,
		singleRound: true,
	};
}

export function formatOwnerDecisionPackMarkdown(pack: OwnerDecisionPack): string {
	const lines: string[] = [`# ${pack.title}`, '', pack.summary, ''];
	const categories: OwnerDecisionCategory[] = [
		'missing-client-facts',
		'ambiguous-data',
		'demo-design-decisions',
		'photograph-acceptance',
		'other-blocking',
	];

	for (const category of categories) {
		const group = pack.items.filter((item) => item.category === category);
		if (group.length === 0) continue;
		lines.push(`## ${category}`, '');
		for (const item of group) {
			lines.push(`### ${item.id}`, '');
			lines.push(`- **Issue:** ${item.issue}`);
			lines.push(`- **Why human input:** ${item.whyHumanInputRequired}`);
			lines.push(`- **Evidence:** ${item.evidence.join('; ') || '—'}`);
			if (item.recommendation) {
				lines.push(`- **Agent recommendation:** ${item.recommendation}`);
			}
			if (item.options?.length) {
				lines.push(`- **Options:** ${item.options.join(' | ')}`);
			}
			lines.push('');
		}
	}

	return `${lines.join('\n').trim()}\n`;
}
