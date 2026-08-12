/**
 * Pure promotion destination decision. No I/O, approvals, schema, or timestamps.
 */
export {
	decidePromotionAction,
	type PromotionDecision,
} from '../../src/lib/status/decision.ts';
export type {
	EnvironmentPromotionState,
	PromotionAction,
	PromotionReasonCode,
} from '../../src/lib/status/types.ts';
