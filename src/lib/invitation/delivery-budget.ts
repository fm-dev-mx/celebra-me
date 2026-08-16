import {
	isOriginRevalidatePublicDocument,
	isPrivateNoStoreCacheContract,
} from './delivery-contract';

export type DeliveryBudgetScenario =
	'versionedAnonymous' | 'legacyStorageAnonymous' | 'personalizedLookupMiss';

export interface DeliveryBudgetCeiling {
	htmlBytes: number;
	uniqueUrlCount: number;
}

/**
 * Document-size and discovered-URL ceilings from production measurements
 * on 2026-08-16 (www.celebra-me.com), plus ~35% headroom.
 * Enforced only by `pnpm invitation:delivery:baseline --assert-budget`.
 * Timing metrics are intentionally absent.
 *
 * Measured HTML bytes: versioned 69_382, legacy 75_902, personalized 69_413.
 * Measured unique document URLs: 40 / 54 / 40.
 */
export const DELIVERY_HTML_BUDGETS: Record<DeliveryBudgetScenario, DeliveryBudgetCeiling> = {
	versionedAnonymous: { htmlBytes: 94_000, uniqueUrlCount: 55 },
	legacyStorageAnonymous: { htmlBytes: 103_000, uniqueUrlCount: 75 },
	personalizedLookupMiss: { htmlBytes: 94_000, uniqueUrlCount: 55 },
};

/** Production document snapshot used to derive the ceilings above. Not a CI fetch. */
export const MEASURED_PRODUCTION_HTML: Record<DeliveryBudgetScenario, DeliveryBudgetCeiling> = {
	versionedAnonymous: { htmlBytes: 69_382, uniqueUrlCount: 40 },
	legacyStorageAnonymous: { htmlBytes: 75_902, uniqueUrlCount: 54 },
	personalizedLookupMiss: { htmlBytes: 69_413, uniqueUrlCount: 40 },
};

export interface DeliveryBudgetObservation {
	id: DeliveryBudgetScenario;
	htmlBytes: number;
	uniqueUrlCount: number;
	cacheControl: string | null;
	personalized: boolean;
	vercelCache: string | null;
}

export function assertDeliveryBudgets(observations: DeliveryBudgetObservation[]): void {
	const failures: string[] = [];
	for (const observation of observations) {
		const ceiling = DELIVERY_HTML_BUDGETS[observation.id];
		if (observation.htmlBytes > ceiling.htmlBytes) {
			failures.push(
				`${observation.id} html ${observation.htmlBytes} B exceeds budget ${ceiling.htmlBytes} B`,
			);
		}
		if (observation.uniqueUrlCount > ceiling.uniqueUrlCount) {
			failures.push(
				`${observation.id} unique URLs ${observation.uniqueUrlCount} exceed budget ${ceiling.uniqueUrlCount}`,
			);
		}
		const cache = observation.cacheControl ?? '';
		if (observation.personalized) {
			if (!isPrivateNoStoreCacheContract(cache)) {
				failures.push(
					`${observation.id} expected private no-store, got ${cache || '(none)'}`,
				);
			}
		} else if (!isOriginRevalidatePublicDocument(cache)) {
			failures.push(
				`${observation.id} expected origin-revalidate public document, got ${cache || '(none)'}`,
			);
		}
		if ((observation.vercelCache ?? '').toUpperCase() === 'HIT') {
			failures.push(
				`${observation.id} document was a shared-cache HIT (${observation.vercelCache})`,
			);
		}
	}
	if (failures.length > 0) {
		throw new Error(`Invitation delivery budget failed:\n- ${failures.join('\n- ')}`);
	}
}
