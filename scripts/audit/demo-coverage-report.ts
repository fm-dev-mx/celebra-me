#!/usr/bin/env node
/**
 * demo-coverage-report.ts
 *
 * Generates a complete demo counterpart coverage matrix for Celebra-me.
 *
 * Run: npx tsx scripts/audit/demo-coverage-report.ts
 * Or:  ts-node --esm scripts/audit/demo-coverage-report.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS = path.join(ROOT, 'src/assets/images/events');
const DEMOS = path.join(ROOT, 'src/content/event-demos');
const PAYLOADS = path.join(ROOT, '.agent/plans/active');

// ── Helpers ──────────────────────────────────────────────────────────────

function readJSON(fp: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function findFiles(root: string, pred: (name: string) => boolean): string[] {
	if (!fs.existsSync(root)) return [];
	const result: string[] = [];
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (pred(entry.name)) result.push(full);
		}
	};
	walk(root);
	return result;
}

// ── Inventory ────────────────────────────────────────────────────────────

const realDirs = fs.existsSync(ASSETS)
	? fs
			.readdirSync(ASSETS, { withFileTypes: true })
			.filter((e) => e.isDirectory() && !e.name.startsWith('demo-'))
			.map((e) => e.name)
			.sort()
	: [];

const demoDirs = fs.existsSync(ASSETS)
	? fs
			.readdirSync(ASSETS, { withFileTypes: true })
			.filter((e) => e.isDirectory() && e.name.startsWith('demo-'))
			.map((e) => e.name)
			.sort()
	: [];

const demoFiles = findFiles(DEMOS, (n) => n.endsWith('.json') && !n.startsWith('_'));
const payloadFiles = findFiles(PAYLOADS, (n) => n.includes('payload') && n.endsWith('.json'));

// ── Load demo data ───────────────────────────────────────────────────────

interface Demo {
	file: string;
	slug: string;
	eventType: string;
	themePreset: string;
	templateId: string;
	assetSlug: string;
	isDemo: boolean;
	title: string;
	visualProfileId?: string;
}

const demos: Demo[] = demoFiles.map((fp) => {
	const d = readJSON(fp);
	const rel = path.relative(ROOT, fp);
	const slug = path.basename(fp, '.json');
	return {
		file: rel,
		slug,
		eventType: (d.eventType as string) ?? '',
		themePreset: ((d.theme as Record<string, unknown>)?.preset as string) ?? '',
		templateId: (d.templateId as string) ?? '',
		assetSlug: (d._assetSlug as string) ?? '',
		visualProfileId: (d.visualProfileId as string) || undefined,
		isDemo: (d.isDemo as boolean) ?? false,
		title: (d.title as string) ?? '',
	};
});

// ── Load real payload data ──────────────────────────────────────────────

interface RealPayload {
	file: string;
	slug: string;
	eventType: string;
	themePreset: string;
	templateId: string;
	assetSlug: string;
	isDemo: boolean;
}

const payloads: RealPayload[] = payloadFiles.map((fp) => {
	const d = readJSON(fp);
	const rel = path.relative(ROOT, fp);
	const slug = path
		.basename(fp, '.json')
		.replace(/-db-payload$/, '')
		.replace(/-payload$/, '');
	return {
		file: rel,
		slug,
		eventType: (d.eventType as string) ?? '',
		themePreset: ((d.theme as Record<string, unknown>)?.preset as string) ?? '',
		templateId: (d.templateId as string) ?? '',
		assetSlug: (d._assetSlug as string) ?? '',
		isDemo: (d.isDemo as boolean) ?? false,
	};
});

// ── Match real invitations to demos ─────────────────────────────────────

interface CoverageRow {
	realDir: string;
	eventType: string;
	themePreset: string;
	expectedTemplateId: string;
	payloadExists: boolean;
	payloadHasTemplateId: boolean;
	demoExists: boolean;
	demoSlug: string | null;
	demoAssetExists: boolean;
	demoMediaIsolation: boolean;
	hasCustomSCSS: boolean;
	visualParityRisk: string;
	actionNeeded: string;
}

// Check for custom SCSS
const scssDir = path.join(ROOT, 'src/styles/themes/sections');
const scssFiles = fs.existsSync(scssDir) ? fs.readdirSync(scssDir) : [];

function hasCustomSCSS(dir: string): boolean {
	return scssFiles.some((f) => f.includes(dir));
}

function findMatchingDemo(expectedTemplateId: string, realDir: string): Demo | undefined {
	const matchingDemos = demos.filter((d) => d.templateId === expectedTemplateId);
	if (matchingDemos.length > 1) {
		return (
			matchingDemos.find((d) => d.visualProfileId && realDir.includes(d.visualProfileId)) ??
			matchingDemos[0]
		);
	}
	return matchingDemos[0];
}

function computeVisualParityRisk(hasCustomSCSS: boolean, matchingDemo: Demo | undefined): string {
	if (!hasCustomSCSS) return 'none';
	if (matchingDemo?.visualProfileId) return 'fixed via visualProfileId';
	return 'slug-specific SCSS overrides - demo may not match visually';
}

function computeActionNeeded(
	payloadExists: boolean,
	payloadHasTemplateId: boolean,
	demoExists: boolean,
	themePreset: string,
): string {
	if (!themePreset && !demoExists) {
		return 'unknown theme - need DB content inspection';
	}
	if (demoExists && payloadExists && !payloadHasTemplateId) {
		return 'add templateId to real payload at next publish/update';
	}
	if (!demoExists) {
		return 'create demo counterpart';
	}
	return 'none';
}

const rows: CoverageRow[] = realDirs.map((dir) => {
	const matchingPayload = payloads.find((p) => p.assetSlug === dir || p.slug === dir);
	const eventType = matchingPayload?.eventType ?? dir.split('-')[0] ?? '';
	const themePreset = matchingPayload?.themePreset ?? '';
	const expectedTemplateId = themePreset ? `${eventType}-${themePreset}` : '';

	const matchingDemo = findMatchingDemo(expectedTemplateId, dir);
	const demoExists = !!matchingDemo;
	const demoAssetExists = matchingDemo ? demoDirs.includes(matchingDemo.assetSlug) : false;
	const demoMediaIsolation = matchingDemo ? !realDirs.includes(matchingDemo.assetSlug) : true;

	const customSCSS = hasCustomSCSS(dir);
	const visualParityRisk = computeVisualParityRisk(customSCSS, matchingDemo);
	const actionNeeded = computeActionNeeded(
		!!matchingPayload,
		!!matchingPayload?.templateId,
		demoExists,
		themePreset,
	);

	return {
		realDir: dir,
		eventType,
		themePreset,
		expectedTemplateId,
		payloadExists: !!matchingPayload,
		payloadHasTemplateId: !!matchingPayload?.templateId,
		demoExists,
		demoSlug: matchingDemo?.slug ?? null,
		demoAssetExists,
		demoMediaIsolation,
		hasCustomSCSS: customSCSS,
		visualParityRisk,
		actionNeeded,
	};
});

// ── Print Report ─────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        Celebra-me — Demo Counterpart Coverage Report       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// Summary
console.log('── Summary ──');
console.log(`  Real invitation asset dirs:  ${realDirs.length}`);
console.log(`  Demo asset dirs:             ${demoDirs.length}`);
console.log(`  Demo content files:          ${demos.length}`);
console.log(`  Local real payloads:         ${payloads.length}`);

const migrated = demos.filter((d) => d.templateId).length;
const missingTid = demos.filter((d) => !d.templateId);
const missingAs = demos.filter((d) => !d.assetSlug);
console.log(`  Demos with templateId:       ${migrated}`);
console.log(`  Demos with _assetSlug:       ${demos.filter((d) => d.assetSlug).length}`);
if (missingTid.length) {
	console.log(`  ⚠️  Missing templateId:       ${missingTid.map((d) => d.slug).join(', ')}`);
}
if (missingAs.length) {
	console.log(`  ⚠️  Missing _assetSlug:       ${missingAs.map((d) => d.slug).join(', ')}`);
}

// Coverage matrix
console.log('');
console.log('── Coverage Matrix ──');
const hdr =
	'  ' +
	'Real Invitation'.padEnd(30) +
	'Event'.padEnd(16) +
	'Theme'.padEnd(20) +
	'TemplateID'.padEnd(25) +
	'Demo'.padEnd(8) +
	'Payload'.padEnd(8) +
	'Risk'.padEnd(8);
console.log('  ' + '─'.repeat(hdr.length - 2));
console.log(hdr);
console.log('  ' + '─'.repeat(hdr.length - 2));

for (const row of rows) {
	const demoStatus = row.demoExists ? '✅' : '❌';
	const payloadStatus =
		row.payloadExists && row.payloadHasTemplateId ? '✅' : row.payloadExists ? '⚠️' : '❌';
	const risk = row.visualParityRisk !== 'none' ? '⚠️' : '  ';
	console.log(
		'  ' +
			row.realDir.padEnd(30) +
			row.eventType.padEnd(16) +
			row.themePreset.padEnd(20) +
			row.expectedTemplateId.padEnd(25) +
			demoStatus.padEnd(8) +
			payloadStatus.padEnd(8) +
			risk,
	);
}
console.log('  ' + '─'.repeat(hdr.length - 2));

// Additional notes
const needsAction = rows.filter((r) => r.actionNeeded !== 'none');
if (needsAction.length) {
	console.log('');
	console.log('── Actions Needed ──');
	for (const row of needsAction) {
		console.log('  \u2022 ' + row.realDir + ': ' + row.actionNeeded);
	}
}

const visualRisks = rows.filter((r) => r.visualParityRisk !== 'none');
if (visualRisks.length) {
	console.log('');
	console.log('── Visual Parity Risks ──');
	for (const row of visualRisks) {
		console.log('  \u26a0\ufe0f  ' + row.realDir + ': ' + row.visualParityRisk);
	}
}

console.log('');
console.log('── Demo Details ──');
for (const demo of demos.sort((a, b) => a.slug.localeCompare(b.slug))) {
	const vpid = demo.visualProfileId ? ' vpid=' + demo.visualProfileId : '';
	console.log(
		'  ' +
			demo.slug.padEnd(42) +
			'tid=' +
			demo.templateId.padEnd(30) +
			'as=' +
			demo.assetSlug.padEnd(30) +
			'dir=' +
			(demoDirs.includes(demo.assetSlug) ? '✅' : demo.assetSlug ? '⚠️ missing' : '❌') +
			vpid,
	);
}

console.log('');
console.log('── Notes ──');
console.log('  ✅ = complete  ⚠️ = partial/manual action required  ❌ = missing');
console.log(
	'  ✅ demo-xv-editorial-magazine uses _assetSlug: "demo-xv-editorial" as temporary doc fallback',
);
console.log('  ✅ xv-valentina-hernandez parity fixed via visualProfileId');
console.log('  ✅ xv-xareni-iyarit parity fixed via visualProfileId');
console.log('  To create dedicated asset directories for profile demos:');
console.log('    mkdir src/assets/images/events/demo-xv-valentina-profile/ && touch index.ts');
console.log('    mkdir src/assets/images/events/demo-xv-xareni-profile/ && touch index.ts');
console.log('');
