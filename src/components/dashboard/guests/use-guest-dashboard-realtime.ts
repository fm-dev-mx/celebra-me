import { useCallback, useEffect, useRef, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type {
	DashboardGuestItem,
	DashboardGuestListResponse,
} from '@/interfaces/dashboard/guest.interface';
import type { DashboardEventListDebug } from '@/interfaces/dashboard/admin.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
}

export type RealtimeState = 'connected' | 'reconnecting' | 'fallback';

const DEFAULT_TOTALS: DashboardGuestListResponse['totals'] = {
	totalInvitations: 0,
	totalPeople: 0,
	generatedInvitations: 0,
	sharedInvitations: 0,
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

function getEventLoadFailureMessage(error: unknown, fallback: string): string {
	if (error && typeof error === 'object' && 'details' in error) {
		const debugReason = (error as { details?: { debug?: { reason?: string } } }).details?.debug
			?.reason;
		if (debugReason === 'missing_access_token' || debugReason === 'invalid_supabase_user') {
			return 'El dashboard no esta autenticando al usuario esperado o la sesion no es valida.';
		}
	}
	return getErrorMessage(error, fallback);
}

function resolvePreferredEventId(initialEventId: string, hostEvents: HostEventItem[]) {
	const storedEventId = window.localStorage.getItem('rsvp-dashboard-event-id') || '';
	const candidates = [initialEventId, storedEventId, hostEvents[0]?.id || ''].filter(Boolean);

	return candidates.find((candidate) => hostEvents.some((event) => event.id === candidate));
}

function shouldLogDashboardDebug(): boolean {
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('debug') === '1';
}

function resolveEventsLoadError(
	initialEventId: string,
	hostEvents: HostEventItem[],
	debug: DashboardEventListDebug | null,
) {
	if (hostEvents.length === 0) {
		if (debug?.session.reason !== 'session_role_resolved') {
			return 'El dashboard no esta autenticando al usuario esperado o la sesion no es valida.';
		}
		if (debug?.slugCheck.slugExistsInDb === false) {
			return `El evento ${debug.slugCheck.expectedSlug} no existe en la base activa. Revisa la sincronizacion de la tabla events.`;
		}
		if (debug?.memberships.length && debug.unresolvedMembershipEventIds.length) {
			return 'La cuenta tiene membresias, pero el dashboard no puede resolver sus eventos. Revisa RLS o migraciones en Supabase.';
		}
		if (debug?.slugCheck.slugExistsInDb) {
			return 'La sesion actual no tiene ownership ni membership sobre el evento ximena-meza-trasvina.';
		}
		return 'No hay eventos asignados a esta cuenta. Si la invitacion existe en contenido, falta sincronizar la tabla events o la membresia del host.';
	}
	if (initialEventId && !hostEvents.some((event) => event.id === initialEventId)) {
		return 'El evento solicitado no esta disponible para esta cuenta o no existe en la base sincronizada.';
	}
	return '';
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
	const [eventsError, setEventsError] = useState('');
	const [guestsError, setGuestsError] = useState('');
	const [eventsDebug, setEventsDebug] = useState<DashboardEventListDebug | null>(null);
	const [realtimeState, setRealtimeState] = useState<RealtimeState>('fallback');
	const [inviteBaseUrl, setInviteBaseUrl] = useState('');
	const reconnectTimerRef = useRef<number | null>(null);
	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);

	const loadEvents = useCallback(async () => {
		try {
			const data = await guestsApi.listEvents();
			setHostEvents(data.items);
			setEventsDebug(data.debug || null);
			const nextEventId = resolvePreferredEventId(initialEventId, data.items);
			const eventsError = resolveEventsLoadError(
				initialEventId,
				data.items,
				data.debug || null,
			);
			setEventsError(eventsError);
			if (shouldLogDashboardDebug()) {
				console.log('[dashboard][client][loadEvents]', {
					initialEventId,
					hostEvents: data.items,
					debug: data.debug || null,
					resolvedEventId: nextEventId || '',
					eventsError,
				});
			}
			if (nextEventId && nextEventId !== eventId) {
				setEventId(nextEventId);
			}
		} catch (error) {
			if (shouldLogDashboardDebug()) {
				console.log('[dashboard][client][loadEvents:error]', error);
			}
			setEventsError(getEventLoadFailureMessage(error, 'No se pudieron cargar eventos.'));
		}
	}, [eventId, initialEventId]);

	const loadGuests = useCallback(async () => {
		if (!eventId) {
			return;
		}
		setLoading(true);
		setGuestsError('');
		try {
			const data = await guestsApi.list({ eventId, search, status });
			setItems(data.items);
			setTotals(data.totals);
			setUpdatedAt(data.updatedAt);
		} catch (error) {
			if (shouldLogDashboardDebug()) {
				console.log('[dashboard][client][loadGuests:error]', {
					eventId,
					search,
					status,
					error,
					eventsDebug,
				});
			}
			setGuestsError(getErrorMessage(error, 'Error de red al cargar invitados.'));
		} finally {
			setLoading(false);
		}
	}, [eventId, eventsDebug, search, status]);

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
		error: eventsError || guestsError,
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
