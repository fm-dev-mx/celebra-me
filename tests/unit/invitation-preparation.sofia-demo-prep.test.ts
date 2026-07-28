import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	assertClassificationRules,
	assertImplementationAllowed,
	buildOwnerDecisionPack,
	canBeginImplementation,
	createPlaceholderToken,
	evaluateEventCompleteness,
	evaluatePreparationReadiness,
	findPlaceholderTokens,
	formatOwnerDecisionPackMarkdown,
	parseFactRegisterFromMarkdown,
	parsePreparationReadinessFromMarkdown,
	type PreparationFact,
} from '@/lib/invitation-preparation';

const FIXTURE_DIR = path.join(
	process.cwd(),
	'tests/fixtures/invitation-preparation/sofia-demo-prep',
);

function readFixture(name: string): string {
	return readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

describe('invitation preparation — sofia-demo-prep scenario', () => {
	it('classifies conversation facts without conflating inference and client statements', () => {
		const chat = readFixture('whatsapp-excerpt.md');
		expect(chat).toContain('Sofía Martínez');
		expect(chat).toContain('Todavía no');
		expect(chat).toMatch(/carpeta/i);

		expect(
			assertClassificationRules({
				classification: 'verified',
				hasSourceEvidence: true,
				representedAsClientStatement: true,
			}).ok,
		).toBe(true);
		expect(
			assertClassificationRules({
				classification: 'inferred',
				hasSourceEvidence: false,
				representedAsClientStatement: true,
			}).ok,
		).toBe(false);
		expect(
			assertClassificationRules({
				classification: 'verified',
				hasSourceEvidence: false,
				representedAsClientStatement: true,
			}).ok,
		).toBe(false);
	});

	it('resumes from canonical Markdown without conversational memory', () => {
		const markdown = readFixture('canonical-state.md');
		expect(parsePreparationReadinessFromMarkdown(markdown)).toBe('READY_WITH_PLACEHOLDERS');

		const facts = parseFactRegisterFromMarkdown(markdown);
		expect(facts.find((fact) => fact.fieldId === 'celebrantName')?.value).toContain('Sofía');
		expect(facts.find((fact) => fact.fieldId === 'baseDemoId')?.classification).toBe('verified');
		expect(findPlaceholderTokens(markdown)).toContain('[[PENDIENTE:DRESS_CODE]]');

		const inventory = readFixture('asset-inventory.md');
		expect(inventory).toContain('provisional-whatsapp');
		expect(inventory).toContain('declared-only');
		expect(inventory).toContain('tests/fixtures/invitation-preparation/sofia-demo-prep/assets');
	});

	it('recomputes completeness, readiness, and a single owner pack from fixture facts', () => {
		const markdown = readFixture('canonical-state.md');
		const parsed = parseFactRegisterFromMarkdown(markdown);
		const facts: PreparationFact[] = [
			...parsed.map((row) => ({
				fieldId: row.fieldId,
				value: row.value,
				classification: row.classification,
			})),
			{
				fieldId: 'distinctVenues',
				value: 'false',
				classification: 'verified',
				source: 'whatsapp-excerpt',
			},
		];

		const completeness = evaluateEventCompleteness('xv', facts);
		expect(completeness.maturity).toBe('evidence-backed');
		expect(completeness.sufficientToPrepare).toBe(true);
		expect(completeness.nonBlockingGaps.map((gap) => gap.fieldId)).toContain('dressCode');

		const readiness = evaluatePreparationReadiness({
			completeness,
			placeholders: [
				{
					token: createPlaceholderToken('dressCode'),
					fieldId: 'dressCode',
					reason: 'Client has not defined dress code',
					blocking: false,
					replacementRequirement: 'Confirm dress code or omit',
				},
			],
			assets: {
				sourcePathProvided: true,
				inventoried: true,
				hasAssignableImages: true,
				onlyNonProductionImages: true,
				blockingIssues: [],
			},
			design: {
				demoClassification: 'verified',
				blockingUnresolvedDecisions: [],
			},
		});

		expect(readiness.readiness).toBe('READY_WITH_PLACEHOLDERS');
		expect(canBeginImplementation(readiness.readiness)).toBe(true);
		expect(() => assertImplementationAllowed(readiness.readiness)).not.toThrow();

		const initialPack = buildOwnerDecisionPack({
			slug: 'sofia-demo-prep',
			blockingGaps: evaluateEventCompleteness('xv', [
				...facts.filter((fact) => fact.fieldId !== 'baseDemoId'),
				{
					fieldId: 'baseDemoId',
					value: 'demo-xv-jewelry-box',
					classification: 'requires_owner_decision',
				},
			]).blockingGaps,
			designDecisions: [
				{
					id: 'baseDemoId',
					classification: 'requires_owner_decision',
					issue: 'Client did not select a demo',
					evidence: ['WhatsApp: Todavía no'],
					recommendation: 'demo-xv-jewelry-box',
					options: ['demo-xv-jewelry-box', 'demo-xv-editorial', 'demo-xv-enchanted-rose'],
				},
			],
			photographIssues: [
				{
					id: 'provisional-assets',
					issue: 'Only provisional WhatsApp photographs are available',
					evidence: ['asset-inventory.md'],
					recommendation: 'Accept provisional for Local; require studio originals for Production',
				},
			],
		});

		expect(initialPack.singleRound).toBe(true);
		const packMarkdown = formatOwnerDecisionPackMarkdown(initialPack);
		expect(packMarkdown).toContain('demo-design-decisions');
		expect(packMarkdown).toContain('photograph-acceptance');
		expect(packMarkdown).toContain('demo-xv-jewelry-box');
	});
});
