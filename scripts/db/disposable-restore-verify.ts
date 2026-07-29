import { spawnSync } from 'node:child_process';
import { classifyDbTarget } from './db-target-config.ts';
import { validateCriticalBackupManifest, type CriticalBackupManifest } from './backup-manifest.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, ...value] = arg.replace(/^--/, '').split('=');
		return [key, value.join('=')];
	}),
);
const manifestPath = resolve(args.get('manifest') ?? '');
const targetDbUrl = args.get('target-db-url') ?? '';
const reportPath = resolve(args.get('report') ?? '.tmp/disposable-restore-report.json');
if (!manifestPath || !targetDbUrl) throw new Error('Required: --manifest=... --target-db-url=...');

const target = classifyDbTarget(targetDbUrl);
if (target.target !== 'disposable-test') {
	throw new Error(`Restore verification target must be disposable/local, got ${target.target}.`);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
validateCriticalBackupManifest(manifest);

const startedAt = Date.now();
const sql = `
select json_build_object(
  'invitations', (select count(*) from public.invitations),
  'events', (select count(*) from public.events),
  'guests', (select count(*) from public.guest_invitations),
  'guestAudit', (select count(*) from public.guest_invitation_audit),
  'orphanGuests', (select count(*) from public.guest_invitations g left join public.events e on e.id=g.event_id where e.id is null),
  'orphanAudit', (select count(*) from public.guest_invitation_audit a left join public.guest_invitations g on g.id=a.guest_invitation_id where g.id is null),
  'orphanEvents', (select count(*) from public.events e left join public.invitations i on i.id=e.invitation_project_id where e.invitation_project_id is not null and i.id is null),
  'receipts', (select count(*) from public.invitation_mutation_operation_receipts)
)::text;`;
const result = spawnSync(
	'psql',
	[
		'--set',
		'ON_ERROR_STOP=1',
		'--tuples-only',
		'--no-align',
		'--dbname',
		targetDbUrl,
		'--command',
		sql,
	],
	{ encoding: 'utf8' },
);
if (result.status !== 0)
	throw new Error(`Disposable restore verification failed: ${result.stderr}`);
const invariants = JSON.parse(result.stdout.trim()) as Record<string, number>;
if (invariants.orphanGuests || invariants.orphanAudit || invariants.orphanEvents) {
	throw new Error(
		`Disposable restore relational invariants failed: ${JSON.stringify(invariants)}`,
	);
}
writeFileSync(
	reportPath,
	JSON.stringify(
		{ manifestPath, target: target.target, elapsedMs: Date.now() - startedAt, invariants },
		null,
		2,
	),
);
console.info(`Disposable restore verification passed: ${reportPath}`);
