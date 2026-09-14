#!/usr/bin/env node
import { basename } from 'node:path';
import { buildPublicationTransitionReport } from './provision/invitation-publication-transition.ts';

function value(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
	const args = process.argv.slice(2);
	const baseSha = value(args, '--base') ?? process.env.VALIDATION_BASE_SHA;
	const headSha = value(args, '--head') ?? process.env.VALIDATION_HEAD_SHA;
	if (!baseSha || !headSha) throw new Error('Both --base and --head exact SHAs are required.');
	const report = buildPublicationTransitionReport({ baseSha, headSha });
	if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
	else {
		for (const warning of report.legacyWarnings)
			console.warn(`WARNING ${warning.slug}: ${warning.reasonCode} — ${warning.nextAction}`);
		for (const transition of report.transitions)
			console.log(`${transition.status} ${transition.slug}: ${transition.reasonCode}`);
		console.log(
			`Publication transitions: ${report.transitions.length}; legacy warnings: ${report.legacyWarnings.length}.`,
		);
	}
	if (report.transitions.some((item) => item.status === 'BLOCKED')) process.exitCode = 1;
}

if (
	/^validate-invitation-publication-transitions\.(?:ts|js)$/.test(basename(process.argv[1] ?? ''))
)
	main();
