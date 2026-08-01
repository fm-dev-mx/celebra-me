#!/usr/bin/env node
/**
 * validate:invitation-preparation
 *
 * Goal 3 automation surface (A1, A3, A4, A6, A7):
 * - Hygiene lints on docs/invitations Markdown files
 * - prepReadiness alignment vs evaluatePreparationReadiness for canonical preparation-state files
 *
 * Usage:
 *   pnpm validate:invitation-preparation
 *   pnpm validate:invitation-preparation -- --file docs/invitations/alba-rosa-quinonez.md
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	evaluateDocumentedPreparationAlignment,
	isCanonicalPreparationStatePath,
	lintInvitationPreparationHygiene,
	parsePreparationReadinessFromMarkdown,
	shouldLintInvitationDocHygiene,
} from '../src/lib/invitation-preparation/index.ts';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVITES_DIR = path.join(PROJECT_ROOT, 'docs', 'invitations');

function listMarkdownFiles(dir: string): string[] {
	const out: string[] = [];
	if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...listMarkdownFiles(full));
		} else if (name.endsWith('.md')) {
			out.push(full);
		}
	}
	return out;
}

function toRepoRelative(absolutePath: string): string {
	return path.relative(PROJECT_ROOT, absolutePath).replace(/\\/g, '/');
}

function parseArgs(argv: string[]): { files: string[] | null } {
	const files: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--file' || arg === '-f') {
			const next = argv[++i];
			if (next) files.push(next);
			continue;
		}
		if (arg.startsWith('--file=')) {
			files.push(arg.slice('--file='.length));
		}
	}
	return { files: files.length > 0 ? files : null };
}

function main(): number {
	const { files: onlyFiles } = parseArgs(process.argv.slice(2));
	const targets = onlyFiles
		? onlyFiles.map((f) => path.resolve(PROJECT_ROOT, f))
		: listMarkdownFiles(INVITES_DIR);

	let errors = 0;
	let hygieneChecked = 0;
	let readinessChecked = 0;

	for (const absolute of targets) {
		const relative = toRepoRelative(absolute);
		if (!relative.replace(/\\/g, '/').startsWith('docs/invitations/')) {
			console.error(`Skipping non-invitation path: ${relative}`);
			continue;
		}
		let markdown: string;
		try {
			markdown = readFileSync(absolute, 'utf8');
		} catch (error) {
			console.error(`Failed to read ${relative}: ${String(error)}`);
			errors += 1;
			continue;
		}

		// A3 + A7 hygiene on invitation docs (skip meta README that documents the rules)
		if (shouldLintInvitationDocHygiene(relative)) {
			hygieneChecked += 1;
			const hygiene = lintInvitationPreparationHygiene(markdown, relative);
			for (const finding of hygiene) {
				console.error(`✖ ${finding.message}`);
				errors += 1;
			}
		}
		const isCanonical = isCanonicalPreparationStatePath(relative);
		const hasReadiness = Boolean(parsePreparationReadinessFromMarkdown(markdown));
		if (!isCanonical || !hasReadiness) continue;

		readinessChecked += 1;
		const alignment = evaluateDocumentedPreparationAlignment(markdown);
		for (const message of alignment.alignmentErrors) {
			console.error(`✖ ${relative}: ${message}`);
			errors += 1;
		}
		if (alignment.alignmentErrors.length === 0 && alignment.helperResult) {
			console.log(
				`✓ ${relative}: prepReadiness ${alignment.documentedReadiness} matches helper (${alignment.eventType})`,
			);
		}
	}

	if (errors === 0) {
		console.log(
			`Invitation preparation validation passed (${hygieneChecked} hygiene file(s), ${readinessChecked} readiness file(s)).`,
		);
		return 0;
	}

	console.error(
		`Invitation preparation validation failed with ${errors} issue(s) across ${hygieneChecked} file(s).`,
	);
	return 1;
}

process.exit(main());
