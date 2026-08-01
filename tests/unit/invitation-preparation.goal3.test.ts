import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
	evaluateDocumentedPreparationAlignment,
	hasUniquenessTableInMarkdown,
	lintInvitationPreparationHygiene,
	parsePhotographInventoryQualitiesFromMarkdown,
	parsePreparationReadinessFromMarkdown,
	summarizeAssetQuality,
} from '@/lib/invitation-preparation';

const FIXTURE = path.join(
	process.cwd(),
	'tests/fixtures/invitation-preparation/alba-like-provisional/canonical-state.md',
);

describe('invitation preparation — Goal 3 A8 alba-like provisional fixture', () => {
	const markdown = readFileSync(FIXTURE, 'utf8');

	it('documents READY_WITH_PLACEHOLDERS and never READY_FOR_IMPLEMENTATION', () => {
		expect(parsePreparationReadinessFromMarkdown(markdown)).toBe('READY_WITH_PLACEHOLDERS');
		expect(markdown).not.toMatch(
			/\*\*Preparation Readiness:\*\*\s*`?READY_FOR_IMPLEMENTATION`?/i,
		);
	});

	it('inventory qualities are non-production and summarize as onlyNonProductionImages', () => {
		const qualities = parsePhotographInventoryQualitiesFromMarkdown(markdown);
		expect(qualities.length).toBeGreaterThan(0);
		expect(qualities.every((q) => q === 'provisional-whatsapp')).toBe(true);
		expect(summarizeAssetQuality(qualities).onlyNonProductionImages).toBe(true);
	});

	it('helper alignment yields READY_WITH_PLACEHOLDERS (A1/A4/A8)', () => {
		const alignment = evaluateDocumentedPreparationAlignment(markdown);
		expect(alignment.alignmentErrors).toEqual([]);
		expect(alignment.helperResult?.readiness).toBe('READY_WITH_PLACEHOLDERS');
		expect(alignment.documentedReadiness).toBe('READY_WITH_PLACEHOLDERS');
		expect(hasUniquenessTableInMarkdown(markdown)).toBe(true);
	});

	it('passes hygiene lint (A3)', () => {
		expect(lintInvitationPreparationHygiene(markdown, 'alba-like-provisional')).toEqual([]);
	});
});

describe('invitation preparation — Goal 3 A3 hygiene rules', () => {
	it('flags absolute paths, chat titles, and portal URLs', () => {
		const dirty = [
			'Source: C:\\Users\\someone\\OneDrive\\Clientes\\cumple\\WhatsApp Chat - Lucero',
			'See https://payroll.example.com/login?token=abc',
			'real._assetSlug === demo._assetSlug for convenience',
		].join('\n');
		const findings = lintInvitationPreparationHygiene(dirty, 'dirty.md');
		expect(findings.some((f) => f.rule === 'absolute-windows-user-path')).toBe(true);
		expect(findings.some((f) => f.rule === 'onedrive-path')).toBe(true);
		expect(findings.some((f) => f.rule === 'clientes-folder')).toBe(true);
		expect(findings.some((f) => f.rule === 'whatsapp-chat-title')).toBe(true);
		expect(findings.some((f) => f.rule === 'credential-bearing-url' || f.rule === 'payroll-hr-portal')).toBe(
			true,
		);
		expect(findings.some((f) => f.rule === 'demo-assetslug-crossover')).toBe(true);
	});
});
