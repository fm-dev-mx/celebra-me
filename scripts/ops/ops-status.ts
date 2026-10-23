/**
 * Prints the sections of scripts/ops/ops-console-snapshot.ts as text, one line per item, for the
 * VS Code task «Estado (ops:status)» and the terminal.
 *
 *   pnpm ops:status                  # git, preflight, worktrees and dbs
 *   pnpm ops:status --remote         # also migrations pending in Preview and Production
 *   pnpm ops:status --section <name> # one section (migrations needs --remote)
 *   pnpm ops:status --json           # array with the requested sections
 *
 * Line format: `[ok|warn|block|unknown] etiqueta: detalle  → comando` (the command only when the
 * snapshot suggests one; the owner runs it in their own terminal). Read-only: it only runs the
 * snapshot script with `--json`, which never fetches, writes refs or writes to a database.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { OpsSnapshotSection } from './ops-console-snapshot.ts';

export type OpsSection = OpsSnapshotSection;
export type OpsSectionName = OpsSection['section'];

export interface OpsStatusOptions {
	sections: OpsSectionName[];
	json: boolean;
	remote: boolean;
}

const LOCAL_SECTIONS: readonly OpsSectionName[] = ['git', 'preflight', 'worktrees', 'dbs'];
const ALL_SECTIONS: readonly OpsSectionName[] = [...LOCAL_SECTIONS, 'migrations'];
/** Resolved from the checkout `pnpm ops:status` runs in, like the other `pnpm ops:*` scripts. */
const SNAPSHOT_SCRIPT = resolve(process.cwd(), 'scripts/ops/ops-console-snapshot.ts');
const USAGE = `Uso: ops-status [--section ${ALL_SECTIONS.join('|')}] [--remote] [--json]`;

export function parseOpsStatusArgs(argv: readonly string[]): OpsStatusOptions {
	const json = argv.includes('--json');
	const remote = argv.includes('--remote');
	const sectionIndex = argv.indexOf('--section');
	if (sectionIndex === -1) {
		return { sections: remote ? [...ALL_SECTIONS] : [...LOCAL_SECTIONS], json, remote };
	}
	const section = argv[sectionIndex + 1] as OpsSectionName;
	if (!ALL_SECTIONS.includes(section)) {
		throw new Error(`${USAGE}\n--section debe ser ${ALL_SECTIONS.join(', ')}.`);
	}
	if (section === 'migrations' && !remote) {
		throw new Error(
			`${USAGE}\nLa sección migrations lee Preview y Production: agregue --remote.`,
		);
	}
	return { sections: [section], json, remote };
}

export function formatOpsItem(item: OpsSection['items'][number]): string {
	const line = `[${item.status}] ${item.label}: ${item.detail}`;
	return item.fix ? `${line}  → ${item.fix}` : line;
}

function pending(section: OpsSection): number {
	return section.items.filter((item) => item.status !== 'ok').length;
}

function sectionHeading(section: OpsSection): string {
	switch (section.section) {
		case 'git': {
			const tags =
				section.tagSource === 'origin' ? 'tags de origin' : 'tags locales (sin red)';
			return `== git · develop +${section.developAhead}/-${section.developBehind} frente a main · ${tags}`;
		}
		case 'preflight': {
			const head = section.headSha ? ` en ${section.headSha.slice(0, 9)}` : '';
			return `== preflight · ${section.checkout} (${section.branch}${head}) · veredicto: ${section.verdict}`;
		}
		case 'worktrees':
			return `== limpieza · ${pending(section)} pendiente(s) en ${section.repoRoot} y sus worktrees`;
		case 'dbs':
			return `== dbs · Local (solo lectura) · ${pending(section)} pendiente(s)`;
		case 'migrations':
			return `== migraciones · Preview y Production (--remote, solo lectura) · ${pending(section)} pendiente(s)`;
	}
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
		[
			'--import',
			'tsx',
			SNAPSHOT_SCRIPT,
			'--section',
			section,
			...(section === 'migrations' ? ['--remote'] : []),
			'--json',
		],
		{
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'inherit'],
			// dbs probes inside the snapshot can take up to two minutes.
			timeout: 180_000,
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
