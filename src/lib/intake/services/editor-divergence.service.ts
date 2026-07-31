/**
 * Server-side managed divergence for the invitation Editor.
 *
 * Data path: managed target state / reconciliation artifact → this service →
 * InvitationEditorContext.divergence → EditorDivergenceBanner.
 *
 * Ownership exclusions come from INVITATION_FIELD_OWNERSHIP (SSOT). This module
 * does not import scripts/ to preserve the Astro server boundary.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isManagedInvitationPath } from '@/lib/intake/mutations/ownership';

export type EditorManagedEnvironment = 'local' | 'preview' | 'production';

export type EditorDivergenceState =
	| 'CLEAN'
	| 'DIVERGED'
	| 'RECONCILIATION_REQUIRED'
	| 'SOURCE_UPDATE_REQUIRED'
	| 'DEFERRED';

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
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		if (host === '127.0.0.1' || host === 'localhost') return 'local';
		if (host.includes('preview') || host.startsWith('preview.')) return 'preview';
		if (process.env.VERCEL_ENV === 'preview') return 'preview';
		if (process.env.VERCEL_ENV === 'production') return 'production';
		if (host.endsWith('supabase.co')) return 'production';
		return 'unverified';
	} catch {
		return 'unverified';
	}
}

export function resolveEditorManagedEnvironment(input?: {
	supabaseUrl?: string;
	expected?: EditorManagedEnvironment;
}): EditorManagedEnvironment {
	const url =
		input?.supabaseUrl ??
		process.env.PUBLIC_SUPABASE_URL ??
		process.env.SUPABASE_URL ??
		process.env.DATABASE_URL;
	const resolved = classifySupabaseUrl(url);
	if (resolved === 'unverified') {
		// Jest unit suites often omit Supabase URL; default local only under test.
		if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
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

/**
 * Resolve Editor divergence for a managed invitation.
 * Prefers the runtime reconciliation artifact; optional explicit paths override.
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

	if (input.slug) {
		const artifact = readRuntimeArtifact(input.slug, targetEnvironment, input.projectRoot);
		if (artifact) {
			const paths = artifact.changedSemanticPaths ?? artifact.unresolvedPaths ?? [];
			const stateHint = (artifact.reconciliationState ??
				artifact.state) as EditorDivergenceState | undefined;
			return computeEditorDivergenceFromPaths({
				targetEnvironment,
				changedPaths: paths,
				stateHint,
				isReleaseBlocked: artifact.isReleaseBlocked,
			});
		}
	}

	return {
		state: 'CLEAN',
		targetEnvironment,
		affectedFieldCount: 0,
		affectedSections: [],
		affectedSectionCount: 0,
		isReleaseBlocked: false,
	};
}
