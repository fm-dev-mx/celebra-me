/**
 * Server-side managed divergence for the invitation Editor.
 *
 * Data path: managed target state / reconciliation artifact → this service →
 * InvitationEditorContext.divergence → EditorDivergenceBanner.
 *
 * Ownership exclusions come from INVITATION_FIELD_OWNERSHIP (SSOT). This module
 * does not import scripts/ to preserve the Astro server boundary.
 *
 * The reconciliation artifact lives in the repository checkout, so reading it only makes
 * sense in a local process. A hosted runtime (Workers) has no checkout and its
 * `node:fs` may be virtual, so detection is skipped there with an explicit NOT_APPLICABLE
 * instead of a misleading CLEAN.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	SUPABASE_PROJECT_REFS,
	extractApiProjectRef,
	type InvitationMutationEnvironment,
} from '@/lib/intake/mutations/environment-identity';
import { isManagedInvitationPath } from '@/lib/intake/mutations/ownership';
import { isLocalProcess } from '@/lib/server/deploy-identity';

export type EditorManagedEnvironment = InvitationMutationEnvironment;

export type EditorDivergenceState =
	| 'CLEAN'
	| 'DIVERGED'
	| 'RECONCILIATION_REQUIRED'
	| 'SOURCE_UPDATE_REQUIRED'
	| 'DEFERRED'
	/** Hosted runtime: no checkout to compare against, so nothing was detected. */
	| 'NOT_APPLICABLE';

export interface EditorDivergenceDTO {
	state: EditorDivergenceState;
	targetEnvironment: EditorManagedEnvironment;
	affectedFieldCount: number;
	affectedSections: string[];
	affectedSectionCount: number;
	isReleaseBlocked: boolean;
}

export class EditorEnvironmentMismatchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EditorEnvironmentMismatchError';
	}
}

function classifySupabaseUrl(url: string | undefined): EditorManagedEnvironment | 'unverified' {
	if (!url) return 'unverified';
	// Classify by the project ref the URL encodes, never by hostname wording or by
	// the hosting platform: a Preview project host does not contain "preview".
	try {
		const ref = extractApiProjectRef(url);
		if (ref === SUPABASE_PROJECT_REFS.local) return 'local';
		if (ref === SUPABASE_PROJECT_REFS.preview) return 'preview';
		if (ref === SUPABASE_PROJECT_REFS.production) return 'production';
		return 'unverified';
	} catch {
		return 'unverified';
	}
}

export function resolveEditorManagedEnvironment(input?: {
	supabaseUrl?: string;
	expected?: EditorManagedEnvironment;
}): EditorManagedEnvironment {
	const url = input?.supabaseUrl ?? process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
	const resolved = classifySupabaseUrl(url);
	if (resolved === 'unverified') {
		// Jest unit suites often omit Supabase URL; default local only under test.
		if (process.env.NODE_ENV === 'test') {
			return 'local';
		}
		throw new EditorEnvironmentMismatchError(
			'EDITOR_ENVIRONMENT_UNVERIFIED: Unable to classify the Editor database environment. Managed divergence refuses to continue.',
		);
	}
	if (input?.expected && input.expected !== resolved) {
		throw new EditorEnvironmentMismatchError(
			`EDITOR_ENVIRONMENT_MISMATCH: Editor expected "${input.expected}" but resolved "${resolved}".`,
		);
	}
	return resolved;
}

function sectionForPath(path: string): string {
	const parts = path.split('.');
	return parts.length > 1 ? parts[0]! : 'general';
}

/** Compute divergence from managed semantic path diffs (tests + live callers). */
export function computeEditorDivergenceFromPaths(input: {
	targetEnvironment: EditorManagedEnvironment;
	changedPaths: string[];
	stateHint?: EditorDivergenceState;
	isReleaseBlocked?: boolean;
}): EditorDivergenceDTO {
	const managedPaths = input.changedPaths.filter(isManagedInvitationPath);
	const sections = Array.from(new Set(managedPaths.map(sectionForPath)));
	if (managedPaths.length === 0) {
		return {
			state: 'CLEAN',
			targetEnvironment: input.targetEnvironment,
			affectedFieldCount: 0,
			affectedSections: [],
			affectedSectionCount: 0,
			isReleaseBlocked: false,
		};
	}
	const state = input.stateHint && input.stateHint !== 'CLEAN' ? input.stateHint : 'DIVERGED';
	return {
		state,
		targetEnvironment: input.targetEnvironment,
		affectedFieldCount: managedPaths.length,
		affectedSections: sections,
		affectedSectionCount: sections.length,
		isReleaseBlocked: input.isReleaseBlocked ?? true,
	};
}

function readRuntimeArtifact(
	slug: string,
	target: EditorManagedEnvironment,
	projectRoot = process.cwd(),
): {
	reconciliationState?: string;
	state?: string;
	changedSemanticPaths?: string[];
	unresolvedPaths?: string[];
	isReleaseBlocked?: boolean;
} | null {
	const filePath = join(
		projectRoot,
		'.agent',
		'runtime',
		'reconciliation',
		`reconciliation-${slug}-${target}.json`,
	);
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, 'utf8')) as {
			reconciliationState?: string;
			state?: string;
			changedSemanticPaths?: string[];
			unresolvedPaths?: string[];
			isReleaseBlocked?: boolean;
		};
	} catch {
		return null;
	}
}

function emptyDivergence(
	state: 'CLEAN' | 'NOT_APPLICABLE',
	targetEnvironment: EditorManagedEnvironment,
): EditorDivergenceDTO {
	return {
		state,
		targetEnvironment,
		affectedFieldCount: 0,
		affectedSections: [],
		affectedSectionCount: 0,
		isReleaseBlocked: false,
	};
}

/**
 * Resolve Editor divergence for a managed invitation.
 * Explicit paths are always computed; the runtime reconciliation artifact is read only in a
 * local process, and a hosted runtime answers NOT_APPLICABLE.
 */
export function resolveEditorDivergence(input: {
	slug: string | null | undefined;
	supabaseUrl?: string;
	expectedEnvironment?: EditorManagedEnvironment;
	changedPaths?: string[];
	projectRoot?: string;
}): EditorDivergenceDTO {
	const targetEnvironment = resolveEditorManagedEnvironment({
		supabaseUrl: input.supabaseUrl,
		expected: input.expectedEnvironment,
	});

	if (input.changedPaths) {
		return computeEditorDivergenceFromPaths({
			targetEnvironment,
			changedPaths: input.changedPaths,
		});
	}

	if (!isLocalProcess()) return emptyDivergence('NOT_APPLICABLE', targetEnvironment);

	if (input.slug) {
		const artifact = readRuntimeArtifact(input.slug, targetEnvironment, input.projectRoot);
		if (artifact) {
			const paths = artifact.changedSemanticPaths ?? artifact.unresolvedPaths ?? [];
			const stateHint = (artifact.reconciliationState ?? artifact.state) as
				EditorDivergenceState | undefined;
			return computeEditorDivergenceFromPaths({
				targetEnvironment,
				changedPaths: paths,
				stateHint,
				isReleaseBlocked: artifact.isReleaseBlocked,
			});
		}
	}

	return emptyDivergence('CLEAN', targetEnvironment);
}
