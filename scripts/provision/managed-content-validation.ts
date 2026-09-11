import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { InvitationContentDraftContentSchema } from '../../src/lib/intake/schemas/invitation-content-draft.schema.ts';

export class ManagedContentSchemaError extends Error {
	readonly code = 'MANAGED_CONTENT_SCHEMA_INVALID';

	constructor(readonly paths: string[]) {
		super(
			`Managed reconciliation produced invalid invitation content${paths.length ? ` at: ${paths.join(', ')}` : ''}.`,
		);
		this.name = 'ManagedContentSchemaError';
	}
}

/** Validate the exact reconciled document before any persistence or publication mutation. */
export function assertManagedContentSchema(content: Record<string, unknown>): void {
	const result = eventContentSchema.safeParse(content);
	if (result.success) return;
	throw new ManagedContentSchemaError([
		...new Set(result.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
	]);
}

export function assertManagedDraftContentSchema(content: Record<string, unknown>): void {
	const result = InvitationContentDraftContentSchema.safeParse(content);
	if (result.success) return;
	throw new ManagedContentSchemaError([
		...new Set(result.error.issues.map((issue) => issue.path.join('.')).filter(Boolean)),
	]);
}
