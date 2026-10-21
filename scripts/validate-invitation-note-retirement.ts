#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { flagValue as value } from './lib/cli-args.ts';

export const INVITATION_NOTES_DIR = 'docs/invitations/';
export const INVITATION_STANDARDS_PATH = 'docs/domains/theme/invitation-standards.md';

const NOTE_PATH = /^docs\/invitations\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/** Slugs of the invitation notes a diff deletes; the uppercase folder README never matches. */
export function deletedNoteSlugs(deletedPaths: readonly string[]): string[] {
	return deletedPaths
		.map((path) => NOTE_PATH.exec(path.trim())?.[1])
		.filter((slug): slug is string => Boolean(slug));
}

/** Slugs listed in the first column of the standards doc's "Retro log" table. */
export function retroLogSlugs(standards: string): Set<string> {
	const slugs = new Set<string>();
	const section = standards.split(/^## Retro log\s*$/m)[1]?.split(/^## /m)[0] ?? '';
	for (const line of section.split(/\r?\n/)) {
		const cell = /^\|\s*`?([a-z0-9]+(?:-[a-z0-9]+)*)`?\s*\|/.exec(line)?.[1];
		if (cell) slugs.add(cell);
	}
	return slugs;
}

/** Deleted notes whose slug has no retro log row at head. */
export function findUnretiredNotes(deletedPaths: readonly string[], standards: string): string[] {
	const logged = retroLogSlugs(standards);
	return deletedNoteSlugs(deletedPaths).filter((slug) => !logged.has(slug));
}

function git(args: string[]): string {
	return execFileSync('git', args, {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

function main(): void {
	const args = process.argv.slice(2);
	const baseSha = value(args, '--base') ?? process.env.VALIDATION_BASE_SHA;
	const headSha = value(args, '--head') ?? process.env.VALIDATION_HEAD_SHA;
	if (!baseSha || !headSha) throw new Error('Both --base and --head exact SHAs are required.');
	const deleted = git([
		'diff',
		'--name-only',
		'--diff-filter=D',
		baseSha,
		headSha,
		'--',
		INVITATION_NOTES_DIR,
	])
		.split('\n')
		.filter(Boolean);
	if (deletedNoteSlugs(deleted).length === 0) {
		console.log('Invitation note retirement: no invitation note deleted.');
		return;
	}
	let standards = '';
	try {
		standards = git(['show', `${headSha}:${INVITATION_STANDARDS_PATH}`]);
	} catch {
		console.error(`${INVITATION_STANDARDS_PATH} is missing at ${headSha}.`);
	}
	const missing = findUnretiredNotes(deleted, standards);
	for (const slug of missing)
		console.error(
			`BLOCKED ${slug}: the note is deleted without a retro log row in ${INVITATION_STANDARDS_PATH}. Run the retro first.`,
		);
	console.log(
		`Invitation note retirement: ${deletedNoteSlugs(deleted).length} deleted; ${missing.length} without a retro.`,
	);
	if (missing.length > 0) process.exitCode = 1;
}

if (/^validate-invitation-note-retirement\.(?:ts|js)$/.test(basename(process.argv[1] ?? '')))
	main();
