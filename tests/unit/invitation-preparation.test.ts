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
	getEventCompletenessContract,
	isPlaceholderToken,
	listEventCompletenessContracts,
	parseFactRegisterFromMarkdown,
	parsePreparationReadinessFromMarkdown,
	planImageOptimization,
	summarizeAssetQuality,
	validatePlaceholderRecords,
	type PreparationFact,
} from '@/lib/invitation-preparation';

function xvFacts(overrides: PreparationFact[] = []): PreparationFact[] {
	const base: PreparationFact[] = [
		{ fieldId: 'slug', value: 'sofia-demo-prep', classification: 'verified', source: 'owner' },
		{
			fieldId: 'celebrantName',
			value: 'Sofía Martínez',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'eventLabel',
			value: 'Mis XV Años',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'eventDate',
			value: '2026-11-14',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'eventTime',
			value: '5:00 PM',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'timeZone',
			value: 'America/Mexico_City',
			classification: 'inferred',
			source: 'default-practice',
			notes: 'Default for MX invites; not explicitly stated.',
		},
		{
			fieldId: 'baseDemoId',
			value: 'demo-xv-jewelry-box',
			classification: 'requires_owner_decision',
			source: 'agent-recommendation',
		},
		{
			fieldId: 'sourceAssetPath',
			value: 'tests/fixtures/invitation-preparation/sofia-demo-prep/assets',
			classification: 'verified',
			source: 'owner-path',
		},
		{
			fieldId: 'sectionOrder',
			value: 'quote,family,countdown,location,itinerary,gallery,rsvp,thankYou',
			classification: 'inferred',
			source: 'demo-default-sections',
		},
		{
			fieldId: 'primaryVenueName',
			value: 'Salón Las Palmas',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'primaryVenueAddress',
			value: 'Av. Reforma 100, CDMX',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'distinctVenues',
			value: 'false',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'rsvpConfirmationMode',
			value: 'both',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'rsvpGuestCap',
			value: '4',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'rsvpWhatsappPhone',
			value: '5215512345678',
			classification: 'verified',
			source: 'whatsapp',
		},
		{
			fieldId: 'dressCode',
			value: '',
			classification: 'missing',
		},
		{
			fieldId: 'musicUrl',
			value: '',
			classification: 'not_applicable',
			notes: 'Client did not request music.',
		},
	];

	const map = new Map(base.map((fact) => [fact.fieldId, fact]));
	for (const override of overrides) {
		map.set(override.fieldId, override);
	}
	return [...map.values()];
}

describe('invitation preparation — classification', () => {
	it('rejects verified without evidence and inferred-as-client-statement', () => {
		expect(
			assertClassificationRules({
				classification: 'verified',
				hasSourceEvidence: false,
				representedAsClientStatement: false,
			}).ok,
		).toBe(false);

		expect(
			assertClassificationRules({
				classification: 'inferred',
				hasSourceEvidence: true,
				representedAsClientStatement: true,
			}).ok,
		).toBe(false);

		expect(
			assertClassificationRules({
				classification: 'verified',
				hasSourceEvidence: true,
				representedAsClientStatement: true,
			}).ok,
		).toBe(true);
	});
});

describe('invitation preparation — event completeness', () => {
	it('marks xv as evidence-backed and leaves under-evidenced types undefined/partial', () => {
		expect(getEventCompletenessContract('xv').maturity).toBe('evidence-backed');
		expect(getEventCompletenessContract('boda').maturity).toBe('partial');
		expect(getEventCompletenessContract('cumple').maturity).toBe('undefined');
		expect(listEventCompletenessContracts()).toHaveLength(6);
	});

	it('distinguishes blocking demo decision from non-blocking dress code', () => {
		const evaluation = evaluateEventCompleteness('xv', xvFacts());
		expect(evaluation.sufficientToPrepare).toBe(false);
		expect(evaluation.blockingGaps.map((gap) => gap.fieldId)).toContain('baseDemoId');
		expect(evaluation.nonBlockingGaps.map((gap) => gap.fieldId)).toContain('dressCode');
		expect(
			evaluation.fields.find((field) => field.fieldId === 'receptionVenueName')?.status,
		).toBe('skipped-condition-false');
	});

	it('becomes sufficient when owner decisions and required facts resolve', () => {
		const evaluation = evaluateEventCompleteness(
			'xv',
			xvFacts([
				{
					fieldId: 'baseDemoId',
					value: 'demo-xv-jewelry-box',
					classification: 'verified',
					source: 'owner-decision',
				},
				{
					fieldId: 'dressCode',
					value: createPlaceholderToken('dressCode'),
					classification: 'missing',
				},
			]),
		);
		expect(evaluation.sufficientToPrepare).toBe(true);
		expect(evaluation.blockingGaps).toHaveLength(0);
	});
});

describe('invitation preparation — placeholders and readiness', () => {
	it('creates searchable placeholder tokens', () => {
		const token = createPlaceholderToken('dressCode');
		expect(token).toBe('[[PENDIENTE:DRESS_CODE]]');
		expect(isPlaceholderToken(token)).toBe(true);
		expect(findPlaceholderTokens(`Código: ${token}`)).toEqual([token]);

		const emptyFieldId = validatePlaceholderRecords([
			{
				token,
				fieldId: '   ',
				reason: 'missing',
				blocking: false,
				replacementRequirement: 'confirm',
			},
		]);
		expect(emptyFieldId.ok).toBe(false);
		if (!emptyFieldId.ok) {
			expect(emptyFieldId.reasons.some((reason) => /fieldId must not be empty/i.test(reason))).toBe(
				true,
			);
		}
	});

	it('transitions NOT_READY → READY_WITH_PLACEHOLDERS → READY_FOR_IMPLEMENTATION', () => {
		const notReadyCompleteness = evaluateEventCompleteness('xv', xvFacts());
		const notReady = evaluatePreparationReadiness({
			completeness: notReadyCompleteness,
			placeholders: [],
			assets: {
				sourcePathProvided: true,
				inventoried: true,
				hasAssignableImages: true,
				onlyNonProductionImages: true,
				blockingIssues: [],
			},
			design: {
				demoClassification: 'requires_owner_decision',
				blockingUnresolvedDecisions: [],
			},
		});
		expect(notReady.readiness).toBe('NOT_READY');
		expect(canBeginImplementation(notReady.readiness)).toBe(false);
		expect(() => assertImplementationAllowed(notReady.readiness)).toThrow(/NOT_READY/);

		const readyCompleteness = evaluateEventCompleteness(
			'xv',
			xvFacts([
				{
					fieldId: 'baseDemoId',
					value: 'demo-xv-jewelry-box',
					classification: 'verified',
					source: 'owner',
				},
			]),
		);
		const dressToken = createPlaceholderToken('dressCode');
		const withPlaceholders = evaluatePreparationReadiness({
			completeness: readyCompleteness,
			placeholders: [
				{
					token: dressToken,
					fieldId: 'dressCode',
					reason: 'Client did not state dress code',
					blocking: false,
					replacementRequirement: 'Confirm formal/casual dress code with client',
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
		expect(withPlaceholders.readiness).toBe('READY_WITH_PLACEHOLDERS');
		expect(withPlaceholders.allowsImplementation).toBe(true);
		expect(withPlaceholders.nonBlockingPlaceholderTokens).toEqual([dressToken]);

		const productionReady = evaluatePreparationReadiness({
			completeness: readyCompleteness,
			placeholders: [],
			assets: {
				sourcePathProvided: true,
				inventoried: true,
				hasAssignableImages: true,
				onlyNonProductionImages: false,
				blockingIssues: [],
			},
			design: {
				demoClassification: 'verified',
				blockingUnresolvedDecisions: [],
			},
		});
		expect(productionReady.readiness).toBe('READY_FOR_IMPLEMENTATION');
	});
});

describe('invitation preparation — assets and owner pack', () => {
	it('plans optimization without promoting provisional WhatsApp images', () => {
		const plan = planImageOptimization({
			sourceFilename: 'hero-wa.jpg',
			role: 'hero-desktop',
			qualityState: 'provisional-whatsapp',
			fileSizeBytes: 80_000,
			needsCropOrDerivative: true,
		});
		expect(plan.recompressRecommended).toBe(false);
		expect(plan.generateDerivative).toBe(false);
		expect(plan.preserveOriginal).toBe(true);

		const quality = summarizeAssetQuality(['provisional-whatsapp', 'provisional-whatsapp']);
		expect(quality.hasAssignableImages).toBe(true);
		expect(quality.onlyNonProductionImages).toBe(true);
	});

	it('emits one consolidated owner decision pack', () => {
		const completeness = evaluateEventCompleteness('xv', xvFacts());
		const pack = buildOwnerDecisionPack({
			slug: 'sofia-demo-prep',
			blockingGaps: completeness.blockingGaps,
			designDecisions: [
				{
					id: 'palette',
					classification: 'requires_owner_decision',
					issue: 'No client colors were stated.',
					evidence: ['WhatsApp transcript has no palette preference'],
					recommendation: 'Ivory + soft gold from jewelry-box preset',
					options: ['jewelry-box default', 'custom dusty-rose'],
				},
			],
			photographIssues: [
				{
					id: 'hero-originals',
					issue: 'Only WhatsApp-compressed hero candidates are available.',
					evidence: ['assets/hero-wa.jpg ~80KB'],
					recommendation: 'Request studio originals before production publish',
				},
			],
		});
		expect(pack.singleRound).toBe(true);
		expect(pack.items.length).toBeGreaterThan(1);
		const markdown = formatOwnerDecisionPackMarkdown(pack);
		expect(markdown).toContain('Owner decision pack — sofia-demo-prep');
		expect(markdown).toContain('demo-design-decisions');
		expect(markdown).toContain('photograph-acceptance');
	});
});

describe('invitation preparation — markdown resume', () => {
	it('parses readiness, facts, and placeholders from canonical markdown', () => {
		const markdown = `
# Canonical Invitation Preparation State — sofia-demo-prep

**Preparation Readiness:** \`READY_WITH_PLACEHOLDERS\`

| field | value | classification | source | notes |
| ----- | ----- | -------------- | ------ | ----- |
| celebrantName | Sofía Martínez | verified | whatsapp |  |
| baseDemoId | demo-xv-jewelry-box | verified | owner |  |
| dressCode | [[PENDIENTE:DRESS_CODE]] | missing |  | non-blocking |

Placeholder: [[PENDIENTE:DRESS_CODE]]
`;
		expect(parsePreparationReadinessFromMarkdown(markdown)).toBe('READY_WITH_PLACEHOLDERS');
		const facts = parseFactRegisterFromMarkdown(markdown);
		expect(facts.find((fact) => fact.fieldId === 'celebrantName')?.classification).toBe(
			'verified',
		);
		expect(findPlaceholderTokens(markdown)).toEqual(['[[PENDIENTE:DRESS_CODE]]']);
	});
});
