import { z } from 'zod';

export const MUTATION_OUTCOME_STATUSES = ['not_applied', 'applied', 'partial', 'replayed'] as const;

export const MutationOutcomeStatusSchema = z.enum(MUTATION_OUTCOME_STATUSES);
export type MutationOutcomeStatus = z.infer<typeof MutationOutcomeStatusSchema>;

export const MUTATION_ACTOR_TYPES = ['admin', 'host', 'operator', 'system', 'recovery'] as const;
export const MutationActorTypeSchema = z.enum(MUTATION_ACTOR_TYPES);
export type MutationActorType = z.infer<typeof MutationActorTypeSchema>;

export const MUTATION_ORIGINS = [
	'editor',
	'legacy_dashboard',
	'managed_cli_local',
	'managed_cli_hosted',
	'system',
	'recovery',
] as const;
export const MutationOriginSchema = z.enum(MUTATION_ORIGINS);
export type MutationOrigin = z.infer<typeof MutationOriginSchema>;

/** Stable UUID representation used to correlate a deterministic managed plan with its receipt. */
export function operationIdFromPlanId(planId: string): string {
	if (!/^[a-f0-9]{32}$/i.test(planId))
		throw new Error('Managed plan ID must be 32 hex characters.');
	return `${planId.slice(0, 8)}-${planId.slice(8, 12)}-4${planId.slice(13, 16)}-8${planId.slice(17, 20)}-${planId.slice(20, 32)}`.toLowerCase();
}

export interface MutationOutcome<Result = Record<string, unknown>> {
	operationId: string;
	status: MutationOutcomeStatus;
	durableMutation: boolean;
	completedSteps: string[];
	result?: Result;
	sanitizedError?: Record<string, unknown>;
	replayedFromOperationId?: string;
}

const SENSITIVE_KEY =
	/(password|secret|token|credential|authorization|service.?role|private.?key|cookie|session)/i;
const SENSITIVE_VALUE =
	/(postgres(?:ql)?:\/\/[^\s]+|bearer\s+\S+|(?:eyJ|sb_(?:secret|publishable)_)[A-Za-z0-9_.-]+)/gi;

function sanitizeString(value: string): string {
	return value.replace(SENSITIVE_VALUE, '[REDACTED]');
}

/** Remove secrets recursively before evidence is accepted by a receipt adapter. */
export function sanitizeMutationEvidence(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === 'string') return sanitizeString(value);
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (Array.isArray(value)) return value.map(sanitizeMutationEvidence);
	if (typeof value !== 'object') return String(value);

	const sanitized: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
		sanitized[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeMutationEvidence(entry);
	}
	return sanitized;
}

export function createMutationOutcome<Result>(input: {
	operationId: string;
	status: MutationOutcomeStatus;
	completedSteps?: string[];
	result?: Result;
	error?: unknown;
	replayedFromOperationId?: string;
}): MutationOutcome<Result> {
	const sanitizedError = input.error
		? (sanitizeMutationEvidence(
				input.error instanceof Error
					? { name: input.error.name, message: input.error.message }
					: { value: input.error },
			) as Record<string, unknown>)
		: undefined;

	return {
		operationId: input.operationId,
		status: input.status,
		durableMutation: input.status === 'applied' || input.status === 'partial',
		completedSteps: [...(input.completedSteps ?? [])],
		...(input.result === undefined ? {} : { result: input.result }),
		...(sanitizedError ? { sanitizedError } : {}),
		...(input.replayedFromOperationId
			? { replayedFromOperationId: input.replayedFromOperationId }
			: {}),
	};
}
