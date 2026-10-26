import { useCallback, useEffect, useState } from 'react';

export const GUEST_SUMMARY_EXPANDED_STORAGE_KEY = 'rsvp-dashboard-guest-summary-expanded';

function readStoredExpanded(): boolean | null {
	try {
		const stored = window.localStorage.getItem(GUEST_SUMMARY_EXPANDED_STORAGE_KEY);
		return stored === 'true' ? true : stored === 'false' ? false : null;
	} catch {
		return null;
	}
}

/**
 * Compact-screen "Ver resumen completo" preference. Starts collapsed so the list
 * leads, and restores the host's last choice after hydration.
 */
export function useGuestSummaryExpanded(): [boolean, (expanded: boolean) => void] {
	const [expanded, setExpandedState] = useState(false);

	useEffect(() => {
		const stored = readStoredExpanded();
		if (stored !== null) setExpandedState(stored);
	}, []);

	const setExpanded = useCallback((next: boolean) => {
		setExpandedState(next);
		try {
			window.localStorage.setItem(GUEST_SUMMARY_EXPANDED_STORAGE_KEY, String(next));
		} catch {
			// Storage can be unavailable (private mode); the choice still applies for this visit.
		}
	}, []);

	return [expanded, setExpanded];
}
