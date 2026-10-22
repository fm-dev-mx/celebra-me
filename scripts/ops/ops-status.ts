/**
 * Prints the `git` and `preflight` sections of scripts/ops/ops-console-snapshot.ts as text, one
 * line per item, for the VS Code task «Estado (ops:status)» and the terminal.
 *
 *   pnpm ops:status                          # both sections
 *   pnpm ops:status --section git|preflight  # one section
 *   pnpm ops:status --json                   # array with the requested sections
 *
 * Line format: `[ok|warn|block] etiqueta: detalle  → comando` (the command only when the snapshot
 * suggests one; the owner runs it in their own terminal). Read-only: it only runs the snapshot
 * script with `--json`, which never fetches, writes refs or touches a database.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { GitSection, PreflightSection } from './ops-console-snapshot.ts';

export type OpsSection = GitSection | PreflightSection;
export type OpsSectionName = OpsSection['section'];

export interface OpsStatusOptions {
	sections: OpsSectionName[];
	json: boolean;
}

const ALL_SECTIONS: readonly OpsSectionName[] = ['git', 'preflight'];
/** Resolved from the checkout `pnpm ops:status` runs in, like the other `pnpm ops:*` scripts. */
const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/ops/ops-console-snapshot.ts');
const USAGE = 'Uso: ops-status [--section git|preflight] [--json]';

export function parseOpsStatusArgs(argv: readonly string[]): OpsStatusOptions {
	const sectionIndex = argv.indexOf('--section');
	if (sectionIndex === -1) return { sections: [...ALL_SECTIONS], json: argv.includes('--json') };
	const section = argv[sectionIndex + 1];
	if (section !== 'git' && section !== 'preflight') {
		throw new Error(`${USAGE}\n--section debe ser git o preflight.`);
	}
	return { sections: [section], json: argv.includes('--json') };
}

export function formatOpsItem(item: OpsSection['items'][number]): string {
	const line = `[${item.status}] ${item.label}: ${item.detail}`;
	return item.fix ? `${line}  → ${item.fix}` : line;
}

function sectionHeading(section: OpsSection): string {
	if (section.section === 'git') {
		const tags = section.tagSource === 'origin' ? 'tags de origin' : 'tags locales (sin red)';
		return `== git · develop +${section.developAhead}/-${section.developBehind} frente a main · ${tags}`;
	}
	const head = section.headSha ? ` en ${section.headSha.slice(0, 9)}` : '';
	return `== preflight · ${section.checkout} (${section.branch}${head}) · veredicto: ${section.verdict}`;
}

export function formatOpsSection(section: OpsSection): string {
	return [sectionHeading(section), ...section.items.map(formatOpsItem)].join('\n');
}

export function formatOpsStatus(sections: readonly OpsSection[]): string {
	return sections.map(formatOpsSection).join('\n\n');
}

function runSnapshot(section: OpsSectionName): OpsSection {
	const stdout = execFileSync(
		process.execPath,
		['--import', 'tsx', SNAPSHOT_SCRIPT, '--section', section, '--json'],
		{
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'inherit'],
			timeout: 90_000,
			maxBuffer: 32 * 1024 * 1024,
			windowsHide: true,
		},
	);
	const start = stdout.indexOf('{');
	if (start === -1) throw new Error(`La sección ${section} no devolvió JSON.`);
	return JSON.parse(stdout.slice(start)) as OpsSection;
}

function main(argv: string[]): void {
	let options: OpsStatusOptions;
	try {
		options = parseOpsStatusArgs(argv);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 2;
		return;
	}
	const sections = options.sections.map(runSnapshot);
	process.stdout.write(
		options.json ? `${JSON.stringify(sections, null, 2)}\n` : `${formatOpsStatus(sections)}\n`,
	);
}

if (/ops-status\.(ts|js|mjs)$/.test(process.argv[1] ?? '')) {
	main(process.argv.slice(2));
}
