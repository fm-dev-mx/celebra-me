import { ApiError } from '@/lib/rsvp/core/errors';
import { hashContent } from '@/lib/content-publication/hash-content';
import { diffContent, type DiffExample } from '@/lib/content-publication/diff-content';
import {
	canPublishByStatus,
	classifyDemoDriftStatus,
	type DemoDriftStatus,
} from '@/lib/content-publication/drift-status';
import {
	loadCanonicalDemoContent,
	validateLocalContent,
} from '@/lib/content-publication/demo-drift';
import { routeKey } from '@/lib/content-publication/_utils';
import {
	findPublishedBySlugAndEventType,
	updatePublishedContentSnapshot,
	type PublishedInvitationContent,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { logAdminAction } from '@/lib/rsvp/services/audit-logger.service';

export interface DemoPublishDryRunResult {
	can_publish: boolean;
	event_type: string;
	slug: string;
	route_key: string;
	local_hash: string;
	prod_hash: string | null;
	expected_prod_hash: string | null;
	status: DemoDriftStatus;
	changed_paths: string[];
	diff_examples: DiffExample[];
	warnings: string[];
}

export interface DemoPublishConfirmResult {
	published: boolean;
	event_type: string;
	slug: string;
	route_key: string;
	previous_version: number | null;
	new_version: number;
	local_hash: string;
	prod_hash_before: string | null;
	prod_hash_after: string;
	audit_log_id?: string;
}

type LoadLocalDemo = () => Promise<Record<string, unknown>>;

async function loadValidatedLocalDemo(input: {
	eventType: string;
	slug: string;
	loadLocalDemo?: LoadLocalDemo;
}): Promise<Record<string, unknown>> {
	const raw = input.loadLocalDemo
		? await input.loadLocalDemo()
		: await loadLocalDemoByIdentity(input.eventType, input.slug);
	const result = validateLocalContent(raw);
	if (!result) {
		throw new ApiError(422, 'schema_mismatch', 'El contenido local del demo no es válido.');
	}
	return result;
}

async function loadLocalDemoByIdentity(
	eventType: string,
	slug: string,
): Promise<Record<string, unknown>> {
	const localDemos = await loadCanonicalDemoContent();
	const content = localDemos[routeKey(eventType, slug)];
	if (!content) {
		throw new ApiError(404, 'not_found', 'No se encontró el demo local solicitado.');
	}
	return content;
}

function assertSafeTarget(row: PublishedInvitationContent | null): void {
	if (row && row.isDemo !== true) {
		throw new ApiError(
			409,
			'unsafe_target',
			'El contenido publicado encontrado no es un demo. La publicación fue bloqueada.',
		);
	}
}

function buildDryRunResult(params: {
	eventType: string;
	slug: string;
	localContent: Record<string, unknown>;
	prodRow: PublishedInvitationContent | null;
}): DemoPublishDryRunResult {
	const localHash = hashContent(params.localContent);
	const prodHash = params.prodRow ? hashContent(params.prodRow.content) : null;
	const status = classifyDemoDriftStatus({
		hasLocal: true,
		hasProd: !!params.prodRow,
		localValid: true,
		prodIsDemo: params.prodRow?.isDemo ?? null,
		localHash,
		prodHash,
	});
	const diff = params.prodRow
		? diffContent(params.prodRow.content, params.localContent)
		: { changedPaths: [], examples: [] };
	// Only 'different' is publishable — 'missing_in_prod' is rejected by confirmDemoPublish
	const canPublish = canPublishByStatus(status);
	return {
		can_publish: canPublish,
		event_type: params.eventType,
		slug: params.slug,
		route_key: routeKey(params.eventType, params.slug),
		local_hash: localHash,
		prod_hash: prodHash,
		expected_prod_hash: prodHash,
		status,
		changed_paths: diff.changedPaths,
		diff_examples: diff.examples,
		warnings: canPublish ? [] : ['No hay cambios publicables para este demo.'],
	};
}

export async function dryRunDemoPublish(input: {
	eventType: string;
	slug: string;
	loadLocalDemo?: LoadLocalDemo;
}): Promise<DemoPublishDryRunResult> {
	const localContent = await loadValidatedLocalDemo(input);
	const prodRow = await findPublishedBySlugAndEventType(input.slug, input.eventType);
	assertSafeTarget(prodRow);
	return buildDryRunResult({
		eventType: input.eventType,
		slug: input.slug,
		localContent,
		prodRow,
	});
}

export async function confirmDemoPublish(input: {
	eventType: string;
	slug: string;
	expectedProdHash: string | null;
	actorUserId: string;
	loadLocalDemo?: LoadLocalDemo;
}): Promise<DemoPublishConfirmResult> {
	const localContent = await loadValidatedLocalDemo(input);
	const prodRow = await findPublishedBySlugAndEventType(input.slug, input.eventType);
	assertSafeTarget(prodRow);

	if (!prodRow) {
		throw new ApiError(
			409,
			'missing_in_prod',
			'Crear demos faltantes queda fuera del primer flujo confirmado.',
		);
	}

	const currentProdHash = hashContent(prodRow.content);
	if (!input.expectedProdHash || currentProdHash !== input.expectedProdHash) {
		throw new ApiError(
			409,
			'stale_production_content',
			'El contenido publicado cambió después de la revisión. Ejecuta una nueva revisión antes de publicar.',
			{ expectedProdHash: input.expectedProdHash, currentProdHash },
		);
	}

	const localHash = hashContent(localContent);
	await logAdminAction({
		actorId: input.actorUserId,
		action: 'demo_publish_backup',
		targetTable: 'published_invitation_content',
		targetId: prodRow.id,
		oldData: {
			operation: 'demo-publish',
			event_type: input.eventType,
			slug: input.slug,
			expected_prod_hash: input.expectedProdHash,
			created_at: new Date().toISOString(),
			before: prodRow,
		},
		newData: {
			local_hash: localHash,
			allowed_columns: ['content', 'version', 'published_at'],
		},
	});

	const nextVersion = prodRow.version + 1;
	const published = await updatePublishedContentSnapshot({
		id: prodRow.id,
		content: localContent,
		version: nextVersion,
		publishedAt: new Date().toISOString(),
	});

	return {
		published: true,
		event_type: input.eventType,
		slug: input.slug,
		route_key: routeKey(input.eventType, input.slug),
		previous_version: prodRow.version,
		new_version: published.version,
		local_hash: localHash,
		prod_hash_before: currentProdHash,
		prod_hash_after: hashContent(published.content),
	};
}
