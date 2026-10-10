import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { reconcileAssets } from '../provision/asset-reconciliation.ts';
import {
	buildSemanticFunctionalChanges,
	computePlanId,
	verifyPlanPreconditions,
	type OperationalPlan,
	type TargetPreconditions,
} from '../provision/invitation-update-plan.ts';
import { DISPOSABLE_DB_URL } from './db-target-config.ts';
import { runCommand, sqlLiteral } from './db-workflow-lib.ts';

interface ScenarioEvidence {
	name: string;
	result: 'pass';
	evidence: Record<string, unknown>;
}

function runPsql(sql: string): string {
	const result = runCommand(
		'psql',
		[
			'--set',
			'ON_ERROR_STOP=1',
			'--tuples-only',
			'--no-align',
			'--no-psqlrc',
			'--dbname',
			DISPOSABLE_DB_URL,
			'--command',
			sql,
		],
		{ redact: [DISPOSABLE_DB_URL] },
	);
	return result.stdout.trim();
}

function runConcurrentPsql(sql: string): Promise<string> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(
			'psql',
			[
				'--set',
				'ON_ERROR_STOP=1',
				'--tuples-only',
				'--no-align',
				'--no-psqlrc',
				'--dbname',
				DISPOSABLE_DB_URL,
				'--command',
				sql,
			],
			{ stdio: ['ignore', 'pipe', 'pipe'] },
		);
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolvePromise(stdout.trim());
			else reject(new Error(stderr || stdout || `psql exited ${String(code)}`));
		});
	});
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function makePlan(preconditions: TargetPreconditions): OperationalPlan {
	return {
		planId: 'phase3-plan',
		invitationSlug: 'phase3-concurrency',
		invitationTitle: 'Phase 3 concurrency',
		sourceHash: 'a'.repeat(64),
		packageHash: 'b'.repeat(64),
		targetEnvironment: 'local',
		verifiedProjectRef: 'persistent-local',
		functionalChanges: [],
		physicalDatabaseOps: { inserts: 0, updates: 1, deletes: 0 },
		storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
		targetPreconditions: preconditions,
		sensitivityClassification: 'public',
		executionStatus: 'PLANNED',
	};
}

async function main(): Promise<void> {
	runCommand('npx', ['-y', 'tsx', 'scripts/db/disposable-test-env.ts', 'reset']);
	const invitationId = randomUUID();
	const draftId = randomUUID();
	const slug = `phase3-${invitationId.slice(0, 8)}`;
	const evidence: ScenarioEvidence[] = [];

	runPsql(`
		insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, kind, created_by)
		values ('${invitationId}', '${slug}', 'Phase 3 concurrency', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'client', 'a0000000-0000-0000-0000-000000000001');
		insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
		values ('${draftId}', '${invitationId}', '{"title":"Initial"}'::jsonb, 'draft');
		create or replace function public.phase3_pause_invitation_update() returns trigger language plpgsql as $$
		begin perform pg_sleep(0.5); return new; end; $$;
		create trigger phase3_pause_invitation_update before update on public.invitations
		for each row when (old.id = '${invitationId}'::uuid) execute function public.phase3_pause_invitation_update();
	`);

	try {
		const initial = JSON.parse(
			runPsql(
				`select json_build_object('invitationUpdatedAt', i.updated_at, 'draftUpdatedAt', d.updated_at)::text from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.id = '${invitationId}';`,
			),
		) as { invitationUpdatedAt: string; draftUpdatedAt: string };
		const metadataRpc = (operationId: string, title: string) =>
			`select public.save_invitation_metadata_atomic(
			  '${operationId}', '${invitationId}', '${initial.invitationUpdatedAt}', '${initial.draftUpdatedAt}',
			  ${sqlLiteral(JSON.stringify({ title, slug, status: 'in_production', clientName: '', clientEmail: '', clientWhatsapp: '', photosReceived: false }))}::jsonb,
			  false, null, 'local', 'celebra-me-rsvp', null, 'system', 'editor'
			)::text;`;
		const metadataResults = await Promise.allSettled([
			runConcurrentPsql(metadataRpc(randomUUID(), 'Editor A')),
			runConcurrentPsql(metadataRpc(randomUUID(), 'Editor B')),
		]);
		const metadataSuccesses = metadataResults.filter(
			(result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled',
		);
		const metadataFailures = metadataResults.filter(
			(result): result is PromiseRejectedResult => result.status === 'rejected',
		);
		assert(
			metadataSuccesses.length === 1,
			'Concurrent metadata saves did not produce one winner.',
		);
		assert(
			metadataFailures.length === 1 &&
				String(metadataFailures[0].reason).includes('editor_stale_invitation'),
			'Concurrent metadata loser was not rejected as stale.',
		);
		assert(
			runPsql(
				`select count(*) from public.invitation_mutation_operation_receipts where invitation_id = '${invitationId}' and command_kind = 'save_editor_metadata';`,
			) === '1',
			'Concurrent metadata saves produced ambiguous receipt history.',
		);
		evidence.push({
			name: 'editor_vs_editor_metadata',
			result: 'pass',
			evidence: { winners: 1, staleRejections: 1, receipts: 1 },
		});

		const idempotentRevision = JSON.parse(
			runPsql(
				`select json_build_object('invitationUpdatedAt', i.updated_at, 'draftUpdatedAt', d.updated_at)::text from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.id = '${invitationId}';`,
			),
		) as { invitationUpdatedAt: string; draftUpdatedAt: string };
		const sharedOperationId = randomUUID();
		const idempotentMetadataRpc = (title: string) =>
			`select public.save_invitation_metadata_atomic(
			  '${sharedOperationId}', '${invitationId}', '${idempotentRevision.invitationUpdatedAt}', '${idempotentRevision.draftUpdatedAt}',
			  ${sqlLiteral(JSON.stringify({ title, slug, status: 'in_production', clientName: '', clientEmail: '', clientWhatsapp: '', photosReceived: false }))}::jsonb,
			  false, null, 'local', 'celebra-me-rsvp', null, 'system', 'editor'
			)::text;`;
		const sharedOperationResults = await Promise.allSettled([
			runConcurrentPsql(idempotentMetadataRpc('Shared Operation Winner')),
			runConcurrentPsql(idempotentMetadataRpc('Shared Operation Winner')),
		]);
		const sharedSuccesses = sharedOperationResults.filter(
			(result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled',
		);
		assert(
			sharedSuccesses.length === 2,
			'Concurrent same-operation_id metadata retries did not both succeed.',
		);
		const sharedPayloads = sharedSuccesses.map(
			(result) =>
				JSON.parse(result.value) as {
					idempotent?: boolean;
				},
		);
		assert(
			sharedPayloads.filter((payload) => payload.idempotent === true).length === 1 &&
				sharedPayloads.filter((payload) => payload.idempotent === false).length === 1,
			'Concurrent same-operation_id metadata did not yield one apply and one replay.',
		);
		assert(
			runPsql(
				`select count(*) from public.invitation_mutation_operation_receipts where operation_id = '${sharedOperationId}'`,
			) === '1',
			'Concurrent same-operation_id metadata created duplicate receipts.',
		);
		assert(
			runPsql(`select title from public.invitations where id = '${invitationId}'`) ===
				'Shared Operation Winner',
			'Concurrent same-operation_id metadata reapplied a divergent mutation.',
		);
		evidence.push({
			name: 'same_operation_id_metadata_idempotency',
			result: 'pass',
			evidence: { successes: 2, receipts: 1, applied: 1, replayed: 1 },
		});

		const expectedDraftRevision = runPsql(
			`select updated_at::text from public.invitation_content_drafts where id = '${draftId}';`,
		);
		const draftUpdate = (title: string) =>
			`update public.invitation_content_drafts set content = ${sqlLiteral(JSON.stringify({ title }))}::jsonb where id = '${draftId}' and updated_at = '${expectedDraftRevision}' returning id::text;`;
		const draftResults = await Promise.all([
			runConcurrentPsql(draftUpdate('Draft A')),
			runConcurrentPsql(draftUpdate('Draft B')),
		]);
		assert(
			draftResults.filter((result) => result.includes(draftId)).length === 1 &&
				draftResults.filter((result) => /UPDATE 0/.test(result)).length === 1,
			'Concurrent draft conditional saves did not produce one winner and one zero-row stale result.',
		);
		evidence.push({
			name: 'editor_vs_editor_draft',
			result: 'pass',
			evidence: { updatedRows: 1, staleZeroRowResults: 1 },
		});

		const plannedDraftRevision = runPsql(
			`select updated_at::text from public.invitation_content_drafts where id = '${draftId}';`,
		);
		const editorPlan = makePlan({
			sourceHash: 'a'.repeat(64),
			packageHash: 'b'.repeat(64),
			verifiedProjectRef: 'persistent-local',
			targetInvitationId: invitationId,
			existingDraftUpdatedAt: plannedDraftRevision,
			existingPublishedVersion: undefined,
		});
		runPsql(
			`update public.invitation_content_drafts set content = '{"title":"Editor after plan"}'::jsonb where id = '${draftId}' and updated_at = '${plannedDraftRevision}';`,
		);
		const currentDraftRevision = runPsql(
			`select updated_at::text from public.invitation_content_drafts where id = '${draftId}';`,
		);
		const editorDrift = verifyPlanPreconditions(editorPlan, {
			sourceHash: 'a'.repeat(64),
			packageHash: 'b'.repeat(64),
			verifiedProjectRef: 'persistent-local',
			targetInvitationId: invitationId,
			existingDraftUpdatedAt: currentDraftRevision,
			existingPublishedVersion: undefined,
		});
		assert(!editorDrift.ok, 'Managed plan accepted an Editor draft mutation after planning.');
		evidence.push({
			name: 'editor_vs_managed_plan',
			result: 'pass',
			evidence: { stalePlanRejected: true, reason: editorDrift.reason },
		});

		const publicationKey = randomUUID();
		const metadataHash = `md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'baseDemoId', i.base_demo_id, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'snapshot', i.snapshot, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text))`;
		runPsql(
			`select public.publish_invitation_atomic(i.id, d.id, d.updated_at, null, ${metadataHash}, md5(d.content::text), '${publicationKey}', i.slug, i.event_type, false, d.content) from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id where i.id = '${invitationId}';`,
		);
		const publishedVersion = Number(
			runPsql(
				`select version from public.published_invitation_content where invitation_project_id = '${invitationId}';`,
			),
		);
		const publicationDrift = verifyPlanPreconditions(
			{
				...editorPlan,
				targetPreconditions: {
					...editorPlan.targetPreconditions,
					existingDraftUpdatedAt: currentDraftRevision,
					existingPublishedVersion: undefined,
				},
			},
			{
				sourceHash: 'a'.repeat(64),
				packageHash: 'b'.repeat(64),
				verifiedProjectRef: 'persistent-local',
				targetInvitationId: invitationId,
				existingDraftUpdatedAt: currentDraftRevision,
				existingPublishedVersion: publishedVersion,
			},
		);
		assert(!publicationDrift.ok, 'Managed plan accepted publication creation after planning.');
		evidence.push({
			name: 'publication_vs_managed_plan',
			result: 'pass',
			evidence: {
				publishedVersion,
				stalePlanRejected: true,
				reason: publicationDrift.reason,
			},
		});

		const canonicalAsset = {
			key: 'hero',
			displayName: 'hero',
			defaultAltText: 'Hero de prueba',
			bucket: 'invitation-assets',
			storagePath: `${invitationId}/hero.webp`,
			sha256: 'c'.repeat(64),
			mimeType: 'image/webp',
			fileSize: 100,
			width: 10,
			height: 10,
			validationVersion: 1,
			originalMimeType: 'image/webp',
			originalFileSize: 100,
			dataBase64: '',
		};
		const managedAsset = {
			id: randomUUID(),
			invitationId,
			displayName: 'hero',
			storagePath: canonicalAsset.storagePath,
			bucket: 'invitation-assets',
			mimeType: 'image/webp',
			fileSize: 100,
			width: 10,
			height: 10,
			validationVersion: 1,
			managedByDefinitionSlug: 'phase3-concurrency',
			managedSourceKey: 'hero',
			managedSha256: canonicalAsset.sha256,
			managedOperationId: randomUUID(),
		};
		const plannedAssets = reconcileAssets({
			canonicalAssets: [canonicalAsset],
			targetDbAssets: [managedAsset],
			observedStorage: {
				[canonicalAsset.storagePath]: { present: true, sha256: canonicalAsset.sha256 },
			},
			policy: 'sync',
			pruneAssets: true,
			definitionSlug: 'phase3-concurrency',
			targetInvitationId: invitationId,
		});
		const currentAssets = reconcileAssets({
			canonicalAssets: [canonicalAsset],
			targetDbAssets: [{ ...managedAsset, managedByDefinitionSlug: null }],
			observedStorage: {
				[canonicalAsset.storagePath]: { present: true, sha256: 'd'.repeat(64) },
			},
			policy: 'sync',
			pruneAssets: true,
			definitionSlug: 'phase3-concurrency',
			targetInvitationId: invitationId,
		});
		const toPlanAction = (action: string): string => {
			if (action === 'UPLOAD') return 'create';
			if (action === 'OVERWRITE' || action === 'REPAIR_METADATA') return 'replace';
			if (action.startsWith('PRUNE_')) return 'delete';
			return 'reuse';
		};
		const plannedChanges = buildSemanticFunctionalChanges({
			sourceContent: {},
			targetContent: {},
			assetActions: plannedAssets.reconciledAssets.map((asset) => ({
				name: asset.displayName,
				action: toPlanAction(asset.plannedAction),
				detail: asset.reasonCode,
			})),
		});
		const currentChanges = buildSemanticFunctionalChanges({
			sourceContent: {},
			targetContent: {},
			assetActions: currentAssets.reconciledAssets.map((asset) => ({
				name: asset.displayName,
				action: toPlanAction(asset.plannedAction),
				detail: asset.reasonCode,
			})),
		});
		const planIdInput = {
			slug: 'phase3-concurrency',
			sourceHash: 'a'.repeat(64),
			targetEnvironment: 'local',
			projectRef: 'persistent-local',
			preconditions: editorPlan.targetPreconditions,
		};
		const plannedAssetPlanId = computePlanId({ ...planIdInput, changes: plannedChanges });
		const currentAssetPlanId = computePlanId({ ...planIdInput, changes: currentChanges });
		assert(
			JSON.stringify(
				plannedChanges
					.filter((change) => change.scope === 'storage')
					.map((change) => [change.entity, change.operation]),
			) !==
				JSON.stringify(
					currentChanges
						.filter((change) => change.scope === 'storage')
						.map((change) => [change.entity, change.operation]),
				),
			'Asset ownership/content drift did not change the reviewed storage operation set.',
		);
		assert(
			plannedAssetPlanId === currentAssetPlanId,
			'Volatile Storage drift incorrectly changed the stable plan identity.',
		);
		assert(
			currentAssets.unreferencedAssets.every(
				(asset) => !asset.plannedAction.startsWith('PRUNE_'),
			),
			'Target-owned asset drift became eligible for prune.',
		);
		evidence.push({
			name: 'asset_plan_vs_target_change',
			result: 'pass',
			evidence: {
				reviewedPlanChanged: true,
				stablePlanIdentity: true,
				targetOwnedPruneCount: currentAssets.summary.plannedDeletes,
			},
		});
	} finally {
		runPsql(
			'drop trigger if exists phase3_pause_invitation_update on public.invitations; drop function if exists public.phase3_pause_invitation_update();',
		);
	}

	const reportPath = resolve('.tmp/phase3-system-concurrency-report.json');
	mkdirSync(dirname(reportPath), { recursive: true });
	writeFileSync(
		reportPath,
		`${JSON.stringify({ version: 1, completedAt: new Date().toISOString(), scenarios: evidence }, null, 2)}\n`,
		{ mode: 0o600 },
	);
	console.info(`Phase 3 system concurrency verification passed (${evidence.length} scenarios).`);
	console.info(`- Report: ${reportPath}`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
