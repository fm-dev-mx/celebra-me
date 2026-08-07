import { createHash } from 'node:crypto';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { hashPublicationProjection } from '../../src/lib/intake/services/publication-diff.service.ts';
import {
	assertPreviewDbUrl,
	extractSupabaseProjectRef,
	getPreviewDbUrl,
	runPsql,
	sqlLiteral,
	type CommandResult,
} from '../db/db-workflow-lib.ts';
import type { PreviewApprovalArtifact } from './preview-approval-service.ts';

export const PREVIEW_LIVE_CHECKLIST_KEYS = [
	'project',
	'route',
	'publication',
	'provenance',
	'projection',
	'storage',
] as const;

export type PreviewLiveChecklistKey = (typeof PREVIEW_LIVE_CHECKLIST_KEYS)[number];

export interface PreviewLiveVerificationDetails {
	packageHash: string;
	slug: string;
	route: string;
	previewProjectRef: string | null;
	expectedPreviewProjectRef: string;
	publicationPresent: boolean;
	provenancePackageHash: string | null;
	provenanceProjectionHash: string | null;
	assetFailures: Record<string, string>;
	errors: string[];
}

export interface PreviewLiveVerificationResult {
	ok: boolean;
	checklistResults: Record<PreviewLiveChecklistKey, boolean>;
	storageHashVerification: Record<string, string>;
	details: PreviewLiveVerificationDetails;
	projectionHash: string | null;
	reviewedAt: string;
}

interface PreviewLiveAssetRow {
	storagePath: string | null;
	providerPublicId: string | null;
	secureUrl: string | null;
}

interface PreviewLiveRow {
	slug: string;
	eventType: string;
	publishedSlug: string;
	publishedEventType: string;
	publishedContent: Record<string, unknown>;
	provenancePackageHash: string | null;
	provenanceDefinitionSlug: string | null;
	provenanceProjectionHash: string | null;
	assets: PreviewLiveAssetRow[];
}

export interface PreviewLiveVerificationOptions {
	dbUrl?: string;
	fetch?: typeof fetch;
	now?: Date;
	runQuery?: (
		sql: string,
		dbUrl: string,
		options: { tuplesOnly: true; throwOnError: true },
	) => CommandResult;
}

function emptyChecklist(): Record<PreviewLiveChecklistKey, boolean> {
	return {
		project: false,
		route: false,
		publication: false,
		provenance: false,
		projection: false,
		storage: false,
	};
}

function parseRows(stdout: string): PreviewLiveRow[] {
	const raw = stdout.trim();
	if (!raw || raw === 'null') return [];
	const parsed = JSON.parse(raw) as unknown;
	return Array.isArray(parsed) ? (parsed as PreviewLiveRow[]) : [];
}

function assetUrl(projectRef: string, expectedPath: string, assets: PreviewLiveAssetRow[]): string {
	const row = assets.find(
		(asset) =>
			asset.storagePath === expectedPath ||
			asset.providerPublicId === expectedPath ||
			asset.secureUrl === expectedPath,
	);
	if (row?.secureUrl) return row.secureUrl;
	if (/^https:\/\//i.test(expectedPath)) return expectedPath;
	const encodedPath = expectedPath.split('/').map(encodeURIComponent).join('/');
	return `https://${projectRef}.supabase.co/storage/v1/object/public/invitation-assets/${encodedPath}`;
}

function queryPreviewRelease(
	artifact: PreviewApprovalArtifact,
	dbUrl: string,
	query: NonNullable<PreviewLiveVerificationOptions['runQuery']>,
): PreviewLiveRow[] {
	const result = query(
		`select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
		 from (
		   select
		     i.slug,
		     i.event_type as "eventType",
		     pub.slug as "publishedSlug",
		     pub.event_type as "publishedEventType",
		     pub.content as "publishedContent",
		     p.package_hash as "provenancePackageHash",
		     p.definition_slug as "provenanceDefinitionSlug",
		     p.applied_published_projection_hash as "provenanceProjectionHash",
		     coalesce((
		       select json_agg(json_build_object(
		         'storagePath', a.storage_path,
		         'providerPublicId', a.provider_public_id,
		         'secureUrl', a.secure_url
		       ))
		       from public.invitation_assets a
		       where a.invitation_id = i.id and a.deleted_at is null
		     ), '[]'::json) as assets
		   from public.invitations i
		   join lateral (
		     select slug, event_type, content
		     from public.published_invitation_content
		     where invitation_project_id = i.id and deleted_at is null
		     order by version desc
		     limit 1
		   ) pub on true
		   left join public.managed_invitation_release_provenance p on p.invitation_id = i.id
		   where i.slug = ${sqlLiteral(artifact.slug)}
		     and i.archived_at is null
		     and i.kind = 'client'
		 ) t;`,
		dbUrl,
		{ tuplesOnly: true, throwOnError: true },
	);
	return parseRows(result.stdout);
}

/**
 * Re-checks the materialized managed release directly against hosted Preview.
 * It is read-only: one SELECT plus public asset downloads.
 */
// eslint-disable-next-line complexity -- Verification intentionally aggregates independent fail-closed machine checks.
export async function verifyPreviewArtifactLive(
	artifact: PreviewApprovalArtifact,
	options: PreviewLiveVerificationOptions = {},
): Promise<PreviewLiveVerificationResult> {
	const reviewedAt = (options.now ?? new Date()).toISOString();
	const checklistResults = emptyChecklist();
	const storageHashVerification: Record<string, string> = {};
	const details: PreviewLiveVerificationDetails = {
		packageHash: artifact.packageHash,
		slug: artifact.slug,
		route: artifact.route,
		previewProjectRef: null,
		expectedPreviewProjectRef: artifact.previewProjectRef,
		publicationPresent: false,
		provenancePackageHash: null,
		provenanceProjectionHash: null,
		assetFailures: {},
		errors: [],
	};
	let projectionHash: string | null = null;

	try {
		const dbUrl = options.dbUrl ?? getPreviewDbUrl().url;
		assertPreviewDbUrl(dbUrl);
		const projectRef = extractSupabaseProjectRef(dbUrl);
		details.previewProjectRef = projectRef;
		checklistResults.project =
			projectRef === SUPABASE_PROJECT_REFS.preview &&
			projectRef === artifact.previewProjectRef;
		if (!checklistResults.project) {
			details.errors.push('Preview project identity does not match the pending approval.');
			return {
				ok: false,
				checklistResults,
				storageHashVerification,
				details,
				projectionHash,
				reviewedAt,
			};
		}

		const rows = queryPreviewRelease(
			artifact,
			dbUrl,
			options.runQuery ?? ((sql, url, queryOptions) => runPsql(sql, url, queryOptions)),
		);
		if (rows.length !== 1) {
			details.errors.push(
				`Expected exactly one active published Preview invitation; found ${rows.length}.`,
			);
			return {
				ok: false,
				checklistResults,
				storageHashVerification,
				details,
				projectionHash,
				reviewedAt,
			};
		}

		const row = rows[0]!;
		details.publicationPresent = Boolean(row.publishedContent);
		details.provenancePackageHash = row.provenancePackageHash;
		details.provenanceProjectionHash = row.provenanceProjectionHash;
		const actualRoute = `/${row.eventType}/${row.slug}`;
		checklistResults.route =
			actualRoute === artifact.route &&
			row.publishedSlug === row.slug &&
			row.publishedEventType === row.eventType;
		checklistResults.publication = details.publicationPresent;
		checklistResults.provenance =
			row.provenancePackageHash === artifact.packageHash &&
			row.provenanceDefinitionSlug === artifact.slug;

		if (row.publishedContent && typeof row.publishedContent === 'object') {
			projectionHash = hashPublicationProjection(row.publishedContent);
		}
		checklistResults.projection =
			projectionHash === artifact.materializedProjectionHash &&
			row.provenanceProjectionHash === projectionHash;

		const fetchImpl = options.fetch ?? fetch;
		const expectedAssets = Object.entries(artifact.expectedAssetHashes);
		for (const [expectedPath, expectedHash] of expectedAssets) {
			try {
				const response = await fetchImpl(
					assetUrl(projectRef, expectedPath, row.assets ?? []),
				);
				if (!response.ok) {
					details.assetFailures[expectedPath] = `HTTP ${response.status}`;
					continue;
				}
				const actualHash = createHash('sha256')
					.update(new Uint8Array(await response.arrayBuffer()))
					.digest('hex');
				storageHashVerification[expectedPath] = actualHash;
				if (actualHash !== expectedHash) {
					details.assetFailures[expectedPath] = 'SHA-256 mismatch';
				}
			} catch (error) {
				details.assetFailures[expectedPath] =
					error instanceof Error ? error.message : 'Asset download failed';
			}
		}
		checklistResults.storage =
			expectedAssets.length === 0 ||
			(expectedAssets.every(
				([path, expectedHash]) => storageHashVerification[path] === expectedHash,
			) &&
				Object.keys(details.assetFailures).length === 0);
	} catch (error) {
		details.errors.push(error instanceof Error ? error.message : String(error));
	}

	return {
		ok: PREVIEW_LIVE_CHECKLIST_KEYS.every((key) => checklistResults[key]),
		checklistResults,
		storageHashVerification,
		details,
		projectionHash,
		reviewedAt,
	};
}
