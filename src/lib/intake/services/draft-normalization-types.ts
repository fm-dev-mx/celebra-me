export type DraftNormalizationIssueReason =
	'conflicting_values' | 'unsupported_shape' | 'unrepresentable_field';

export interface DraftNormalizationIssue {
	path: string;
	reason: DraftNormalizationIssueReason;
	detail: string;
}

/** Raised when a persisted draft holds data the flat draft contract cannot express. */
export class DraftNormalizationError extends Error {
	readonly code = 'draft_normalization_unsupported';

	constructor(readonly issues: DraftNormalizationIssue[]) {
		super(
			`DRAFT_NORMALIZATION_UNSUPPORTED: ${issues
				.map((issue) => `${issue.path} — ${issue.detail}`)
				.join('; ')}`,
		);
		this.name = 'DraftNormalizationError';
	}
}
