import { useCallback, useMemo, useState } from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	filterGuestsForReview,
	type GuestReviewFilterValue,
} from '@/components/dashboard/guests/guest-presenter';

/** Search, group and stage filters applied on the client to the full event list. */
export function useGuestListFilters(
	items: DashboardGuestItem[],
	reminderEligibleIds: ReadonlySet<string>,
) {
	const [search, setSearch] = useState('');
	const [group, setGroup] = useState('all');
	const [reviewFilter, setReviewFilter] = useState<GuestReviewFilterValue>('all');

	const visibleItems = useMemo(
		() => filterGuestsForReview(items, { reviewFilter, group, reminderEligibleIds, search }),
		[items, reviewFilter, group, reminderEligibleIds, search],
	);

	const clearFilters = useCallback(() => {
		setReviewFilter('all');
		setGroup('all');
		setSearch('');
	}, []);

	return {
		search,
		setSearch,
		group,
		setGroup,
		reviewFilter,
		setReviewFilter,
		visibleItems,
		isFiltered: reviewFilter !== 'all' || group !== 'all' || search.trim() !== '',
		clearFilters,
	};
}
