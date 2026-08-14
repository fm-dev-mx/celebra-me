import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	resolveDbUrl,
} from './db-target-config.ts';
import { getProdDbUrl, runCommand } from './db-workflow-lib.ts';
import { buildMutationSchemaContractQuery } from './mutation-schema-contract-query.ts';

const targetIndex = process.argv.indexOf('--target');
const targetArgument = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
if (!targetArgument) {
	throw new Error('Required: --target <production|preview|persistent-local|disposable-test>');
}
const dbUrl =
	targetArgument === 'production'
		? getProdDbUrl().url
		: targetArgument === 'preview'
			? getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES)
			: resolveDbUrl(targetArgument);
if (!dbUrl) throw new Error(`Database URL is unavailable for target ${targetArgument}.`);
const classification = classifyDbTarget(dbUrl);
if (classification.target !== targetArgument) {
	throw new Error(
		`Mutation schema contract target mismatch: requested ${targetArgument}, got ${classification.target}.`,
	);
}

const result = runCommand(
	'psql',
	[
		'--set',
		'ON_ERROR_STOP=1',
		'--no-psqlrc',
		'--tuples-only',
		'--no-align',
		'--dbname',
		dbUrl,
		'--command',
		buildMutationSchemaContractQuery(),
	],
	{ redact: [dbUrl] },
);

const evidence = JSON.parse(result.stdout.trim()) as Record<string, boolean>;
const expectedTrue = [
	'receiptTable',
	'phase2Columns',
	'metadataRpc',
	'restoreRpc',
	'submitRsvpRpc',
	'trackViewRpc',
	'serviceRoleMetadataExecute',
	'serviceRoleRestoreExecute',
	'serviceRoleSubmitRsvpExecute',
	'serviceRoleTrackViewExecute',
	'guestRlsEnabled',
	'guestRlsForced',
	'receiptSelect',
	'receiptInsert',
	'metadataRpcSerializesInvitation',
	'restoreRpcSerializesInvitation',
	'receiptOperationIdUnique',
	'phase1Migration',
	'phase2Migration',
	'receiptLockMigration',
	'publicGuestRpcMigration',
	'publicGuestRpcCommentAuditFixMigration',
	'publicGuestRpcPgcryptoQualifyMigration',
	'submitRsvpUsesExtensionsGenRandomBytes',
];
const expectedFalse = [
	'authenticatedMetadataExecute',
	'authenticatedRestoreExecute',
	'serviceRoleGuestInsert',
	'serviceRoleGuestUpdate',
	'serviceRoleGuestDelete',
	'serviceRoleGuestAuditInsert',
	'serviceRoleGuestAuditUpdate',
	'serviceRoleGuestAuditDelete',
	'receiptUpdate',
	'receiptDelete',
	'metadataRpcLocksReceipts',
	'restoreRpcLocksReceipts',
	'anonSubmitRsvpExecute',
	'authenticatedSubmitRsvpExecute',
	'anonTrackViewExecute',
	'authenticatedTrackViewExecute',
];
const failures = [
	...expectedTrue.filter((key) => evidence[key] !== true).map((key) => `${key}=false`),
	...expectedFalse.filter((key) => evidence[key] !== false).map((key) => `${key}=true`),
];
if (failures.length > 0) {
	throw new Error(
		`Required mutation schema contract is not deployable on ${targetArgument}: ${failures.join(', ')}`,
	);
}

console.info(`Mutation schema contract verified for ${targetArgument}.`);
console.info(
	'- Required migrations, columns, RPCs, grants, RSVP isolation, and append-only privileges: PASS',
);
