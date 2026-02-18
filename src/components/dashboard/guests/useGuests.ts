import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/apiClient';
import type { DashboardGuestItem, DashboardGuestListResponse } from './types';

interface UseGuestsReturn {
	items: DashboardGuestItem[];
	totals: DashboardGuestListResponse['totals'];
	updatedAt: string;
	loading: boolean;
	error: string;
	realtimeState: 'connected' | 'reconnecting' | 'fallback';
	loadGuests: () => Promise<void>;
}

const DEFAULT_TOTALS: DashboardGuestListResponse['totals'] = {
	totalInvitations: 0,
	totalPeople: 0,
	pendingInvitations: 0,
	pendingPeople: 0,
	confirmedInvitations: 0,
	confirmedPeople: 0,
	declinedInvitations: 0,
	declinedPeople: 0,
	viewed: 0,
};

export function useGuests({
	eventId,
	search = '',
	status = 'all',
}: {
	eventId: string;
	search?: string;
	status?: string;
}): UseGuestsReturn {
	const [items, setItems] = useState<DashboardGuestItem[]>([]);
	const [totals, setTotals] = useState(DEFAULT_TOTALS);
	const [updatedAt, setUpdatedAt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [realtimeState, setRealtimeState] = useState<'connected' | 'reconnecting' | 'fallback'>(
		'fallback',
	);

	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);

	const loadGuests = useCallback(async () => {
		if (!eventId) {
			console.info('[useGuests] No eventId, skipping loadGuests');
			return;
		}
		setLoading(true);
		setError('');
		try {
			console.info('[useGuests] Loading guests for event:', eventId);
			const params = new URLSearchParams({ eventId, search, status });
			const result = await dashboardApi.get<DashboardGuestListResponse>(
				`/api/dashboard/guests?${params.toString()}`,
			);

			if (!result.ok) {
				throw new Error(result.message || `Error ${result.status}`);
			}

			setItems(result.data.items);
			setTotals(result.data.totals);
			setUpdatedAt(result.data.updatedAt);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Error de red al cargar invitados.';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [eventId, search, status]);

	const connectStream = useCallback(() => {
		if (!eventId) return () => {};
		const streamUrl = `/api/dashboard/guests/stream?eventId=${encodeURIComponent(eventId)}`;
		const source = new EventSource(streamUrl, { withCredentials: true });
		setRealtimeState('reconnecting');

		const scheduleRefresh = () => {
			if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
			refreshDebounceRef.current = window.setTimeout(() => {
				void loadGuests();
			}, 350);
		};

		source.addEventListener('guest_updated', () => {
			scheduleRefresh();
		});

		source.addEventListener('heartbeat', () => {
			reconnectAttemptRef.current = 0;
			setRealtimeState('connected');
		});

		source.onerror = () => {
			source.close();
			setRealtimeState('fallback');
			const nextAttempt = reconnectAttemptRef.current + 1;
			reconnectAttemptRef.current = nextAttempt;
			const backoff = Math.min(10000, [1000, 2000, 5000, 10000][nextAttempt - 1] ?? 10000);
			reconnectTimerRef.current = window.setTimeout(() => {
				setRealtimeState('reconnecting');
				connectStream();
			}, backoff);
		};

		return () => {
			source.close();
		};
	}, [eventId, loadGuests]);

	useEffect(() => {
		const disconnect = connectStream();
		return () => {
			disconnect();
			if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
			if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
		};
	}, [connectStream]);

	useEffect(() => {
		if (realtimeState !== 'fallback') return;
		const id = window.setInterval(() => {
			void loadGuests();
		}, 45000);
		return () => window.clearInterval(id);
	}, [realtimeState, loadGuests]);

	useEffect(() => {
		if (!eventId) return;
		void loadGuests();
	}, [eventId, loadGuests]);

	return {
		items,
		totals,
		updatedAt,
		loading,
		error,
		realtimeState,
		loadGuests,
	};
}
