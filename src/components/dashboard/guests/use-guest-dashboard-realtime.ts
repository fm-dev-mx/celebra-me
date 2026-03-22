import { useCallback, useEffect, useRef, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type { DashboardGuestItem, DashboardGuestListResponse } from './types';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: string;
}

export type RealtimeState = 'connected' | 'reconnecting' | 'fallback';

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

interface NotificationPayload {
	message: string;
	type: 'info' | 'success' | 'warning';
}

interface UseGuestDashboardRealtimeOptions {
	initialEventId: string;
	search: 'all' | string;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	onNotification: (notification: NotificationPayload) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function resolvePreferredEventId(initialEventId: string, hostEvents: HostEventItem[]) {
	const storedEventId = window.localStorage.getItem('rsvp-dashboard-event-id') || '';
	const candidates = [initialEventId, storedEventId, hostEvents[0]?.id || ''].filter(Boolean);

	return candidates.find((candidate) => hostEvents.some((event) => event.id === candidate));
}

export const useGuestDashboardRealtime = ({
	initialEventId,
	search,
	status,
	onNotification,
}: UseGuestDashboardRealtimeOptions) => {
	const [eventId, setEventId] = useState<string>(initialEventId || '');
	const [hostEvents, setHostEvents] = useState<HostEventItem[]>([]);
	const [items, setItems] = useState<DashboardGuestItem[]>([]);
	const [totals, setTotals] = useState(DEFAULT_TOTALS);
	const [updatedAt, setUpdatedAt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [realtimeState, setRealtimeState] = useState<RealtimeState>('fallback');
	const [inviteBaseUrl, setInviteBaseUrl] = useState('');
	const reconnectTimerRef = useRef<number | null>(null);
	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);

	const loadEvents = useCallback(async () => {
		try {
			const data = await guestsApi.listEvents();
			setHostEvents(data.items);
			const nextEventId = resolvePreferredEventId(initialEventId, data.items);
			if (nextEventId && nextEventId !== eventId) {
				setEventId(nextEventId);
			}
		} catch (error) {
			setError(getErrorMessage(error, 'No se pudieron cargar eventos.'));
		}
	}, [eventId, initialEventId]);

	const loadGuests = useCallback(async () => {
		if (!eventId) {
			return;
		}
		setLoading(true);
		setError('');
		try {
			const data = await guestsApi.list({ eventId, search, status });
			setItems(data.items);
			setTotals(data.totals);
			setUpdatedAt(data.updatedAt);
		} catch (error) {
			setError(getErrorMessage(error, 'Error de red al cargar invitados.'));
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
			onNotification({ message: 'Cambios detectados en los invitados.', type: 'info' });
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
	}, [eventId, loadGuests, onNotification]);

	useEffect(() => {
		void loadEvents();
	}, [loadEvents]);

	useEffect(() => {
		void loadGuests();
	}, [loadGuests]);

	useEffect(() => {
		try {
			setInviteBaseUrl(window.location.origin);
		} catch (err) {
			console.error('[GuestDashboard] useEffect setInviteBaseUrl error:', err);
		}
	}, []);

	useEffect(() => {
		try {
			if (!eventId) return;
			window.localStorage.setItem('rsvp-dashboard-event-id', eventId);
		} catch (err) {
			console.error('[GuestDashboard] useEffect localStorage error:', err);
		}
	}, [eventId]);

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
	}, [loadGuests, realtimeState]);

	return {
		error,
		eventId,
		hostEvents,
		inviteBaseUrl,
		items,
		loading,
		loadGuests,
		realtimeState,
		setEventId,
		setItems,
		totals,
		updatedAt,
	};
};
