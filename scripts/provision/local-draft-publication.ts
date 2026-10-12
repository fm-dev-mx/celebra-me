/**
 * local-draft-publication.ts — Pure draft-write decision and error formatting for the
 * persistent-local managed apply.
 *
 * Extracted so hermetic Jest can cover the approved-draft republish contract without a
 * Local Supabase instance.
 */

/**
 * - `insert`: no draft exists yet.
 * - `replace_content`: draft content diverges; the content update also resets status.
 * - `reset_status`: content is identical but a publish is needed and the draft is not in
 *   `draft` status (publish_invitation_atomic leaves it `approved`), so only the status resets.
 * - `none`: nothing to write.
 */
export type LocalDraftMutation = 'insert' | 'replace_content' | 'reset_status' | 'none';

export function resolveLocalDraftMutation(input: {
	existingDraft: { status?: unknown } | null | undefined;
	isDraftContentIdentical: boolean;
	shouldPublish: boolean;
}): LocalDraftMutation {
	if (!input.existingDraft) return 'insert';
	if (!input.isDraftContentIdentical) return 'replace_content';
	if (input.shouldPublish && input.existingDraft.status !== 'draft') return 'reset_status';
	return 'none';
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Renders thrown values for operator output. supabase-js returns PostgREST errors as plain
 * objects, which `String(err)` collapses to "[object Object]".
 */
export function describeApplyError(err: unknown): string {
	if (typeof err === 'string') return err;
	if (err === null || typeof err !== 'object') return String(err);

	const record = err as Record<string, unknown>;
	const message = nonEmptyString(record.message);
	const code = nonEmptyString(record.code);
	const details = nonEmptyString(record.details);
	const hint = nonEmptyString(record.hint);

	if (!message && !code && !details && !hint) {
		if (err instanceof Error) return err.name;
		try {
			return JSON.stringify(err);
		} catch {
			return Object.prototype.toString.call(err);
		}
	}

	const parts = [message ?? 'Unknown error'];
	if (code) parts.push(`(code: ${code})`);
	if (details) parts.push(`details: ${details}`);
	if (hint) parts.push(`hint: ${hint}`);
	return parts.join(' ');
}
