import {
	classifyDbTarget,
	getSecretFromEnvOrFiles,
	PREVIEW_SECRET_FILES,
	resolveDbUrl,
} from './db-target-config.ts';
import { getProdDbUrl, runCommand } from './db-workflow-lib.ts';

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
		`select json_build_object(
		  'receiptTable', to_regclass('public.invitation_mutation_operation_receipts') is not null,
		  'phase2Columns', (
		    select count(*) = 8 from information_schema.columns
		    where table_schema = 'public' and (
		      (table_name = 'managed_invitation_release_provenance' and column_name in ('applied_operation_id','applied_published_version','applied_published_projection_hash'))
		      or (table_name = 'invitation_assets' and column_name in ('managed_by_definition_slug','managed_source_key','managed_sha256','managed_operation_id'))
		      or (table_name = 'invitation_mutation_operation_receipts' and column_name = 'retry_of_operation_id')
		    )
		  ),
		  'metadataRpc', to_regprocedure('public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)') is not null,
		  'restoreRpc', to_regprocedure('public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)') is not null,
		  'serviceRoleMetadataExecute', coalesce(has_function_privilege('service_role', to_regprocedure('public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)'), 'EXECUTE'), false),
		  'serviceRoleRestoreExecute', coalesce(has_function_privilege('service_role', to_regprocedure('public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)'), 'EXECUTE'), false),
		  'authenticatedMetadataExecute', coalesce(has_function_privilege('authenticated', to_regprocedure('public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)'), 'EXECUTE'), false),
		  'authenticatedRestoreExecute', coalesce(has_function_privilege('authenticated', to_regprocedure('public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)'), 'EXECUTE'), false),
		  'serviceRoleGuestInsert', has_table_privilege('service_role', 'public.guest_invitations', 'INSERT'),
		  'serviceRoleGuestUpdate', has_table_privilege('service_role', 'public.guest_invitations', 'UPDATE'),
		  'serviceRoleGuestDelete', has_table_privilege('service_role', 'public.guest_invitations', 'DELETE'),
		  'receiptUpdate', coalesce(has_table_privilege('service_role', to_regclass('public.invitation_mutation_operation_receipts'), 'UPDATE'), false),
		  'receiptDelete', coalesce(has_table_privilege('service_role', to_regclass('public.invitation_mutation_operation_receipts'), 'DELETE'), false),
		  'phase1Migration', exists(select 1 from supabase_migrations.schema_migrations where version = '20260729140514'),
		  'phase2Migration', exists(select 1 from supabase_migrations.schema_migrations where version = '20260729152113')
		)::text;`,
	],
	{ redact: [dbUrl] },
);

const evidence = JSON.parse(result.stdout.trim()) as Record<string, boolean>;
const expectedTrue = [
	'receiptTable',
	'phase2Columns',
	'metadataRpc',
	'restoreRpc',
	'serviceRoleMetadataExecute',
	'serviceRoleRestoreExecute',
	'phase1Migration',
	'phase2Migration',
];
const expectedFalse = [
	'authenticatedMetadataExecute',
	'authenticatedRestoreExecute',
	'serviceRoleGuestInsert',
	'serviceRoleGuestUpdate',
	'serviceRoleGuestDelete',
	'receiptUpdate',
	'receiptDelete',
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
