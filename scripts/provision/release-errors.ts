/**
 * Typed failures raised by the managed release engine. Operator-facing CLIs classify these by
 * class and `failure`, never by matching message text.
 */

export const PRECONDITION_FAILURES = [
	'PACKAGE_SOURCE_CHANGED',
	'PACKAGE_CHANGED',
	'ASSET_MANIFEST_CHANGED',
	'PROJECT_CHANGED',
	'INVITATION_ID_CHANGED',
	'OWNER_CHANGED',
	'DRAFT_CHANGED',
	'PUBLISHED_VERSION_CHANGED',
	'PLAN_CHANGED',
] as const;

export type PreconditionFailure = (typeof PRECONDITION_FAILURES)[number];

/** The confirmed plan no longer matches the target, the source or the package. */
export class PreconditionFailedError extends Error {
	readonly code = 'PRECONDITION_FAILED';

	constructor(
		readonly failure: PreconditionFailure,
		message: string,
	) {
		super(message);
		this.name = 'PreconditionFailedError';
	}
}

/** The engine returned no plan, receipt or result bound to the confirmed plan. */
export class InvalidEngineResultError extends Error {
	readonly code = 'INVALID_ENGINE_RESULT';

	constructor(
		message: string,
		readonly mutationStarted = false,
	) {
		super(message);
		this.name = 'InvalidEngineResultError';
	}
}

/** The applied target does not match the plan, so release provenance was not recorded. */
export class FinalTargetVerificationError extends Error {
	readonly code = 'FINAL_TARGET_VERIFICATION_FAILED';

	constructor(
		message = 'Final target verification failed; managed-release provenance was not recorded.',
	) {
		super(message);
		this.name = 'FinalTargetVerificationError';
	}
}
