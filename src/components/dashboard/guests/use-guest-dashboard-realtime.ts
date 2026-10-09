import { useCallback, useEffect, useState } from 'react';
import { guestsApi } from '@/lib/dashboard/guests-api';
import type {
	DashboardGuestItem,
	DashboardGuestListResponse,
} from '@/interfaces/dashboard/guest.interface';
import type { DashboardEventListDebug } from '@/interfaces/dashboard/admin.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import {
	resolveShareTemplates,
	resolveReminderSettings,
	type ShareMessagesConfig,
	type ReminderSettings,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import {
	buildShareMessageDateContext,
	type ShareMessageDateContext,
} from '@/lib/rsvp/services/shared/share-message-date';
import {
	getEventLoadFailureMessage,
	resolveEventsLoadError,
} from '@/lib/dashboard/guest-dashboard-events-errors';

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: EventRecord['eventType'];
}

export type RealtimeState = 'connected' | 'fallback';

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
	unconfirmedShared: 0,
	viewed: 0,
};

interface UseGuestDashboardRealtimeOptions {
	initialEventId: string;
}

const DASHBOARD_POLLING_INTERVAL_MS = 25000; // 25 seconds is a safe, stable interval for Serverless tasks.

function resolvePreferredEventId(initialEventId: string, hostEvents: HostEventItem[]) {
	const storedEventId = window.localStorage.getItem('rsvp-dashboard-event-id') || '';
	const candidates = [initialEventId, storedEventId, hostEvents[0]?.id || ''].filter(Boolean);

	return candidates.find((candidate) => hostEvents.some((event) => event.id === candidate));
}

function shouldLogDashboardDebug(): boolean {
	if (typeof window === 'undefined') return false;
	return new URLSearchParams(window.location.search).get('debug') === '1';
}

/**
 * Loads the event's full guest list. Search and filters run on the client so the
 * overview totals always describe the whole event and typing never refetches.
 */
export const useGuestDashboardRealtime = ({ initialEventId }: UseGuestDashboardRealtimeOptions) => {
	const [eventId, setEventId] = useState<string>(initialEventId || '');
	const [hostEvents, setHostEvents] = useState<HostEventItem[]>([]);
	const [items, setItems] = useState<DashboardGuestItem[]>([]);
	const [totals, setTotals] = useState(DEFAULT_TOTALS);
	const [shareTemplates, setShareTemplates] =
		useState<ShareMessagesConfig>(resolveShareTemplates());
	const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
		resolveReminderSettings(null),
	);
	const [shareDateContext, setShareDateContext] = useState<ShareMessageDateContext>(
		buildShareMessageDateContext(null, null, '', new Date()),
	);
	const [updatedAt, setUpdatedAt] = useState('');
	const [loading, setLoading] = useState(false);
	const [eventsError, setEventsError] = useState('');
	const [guestsError, setGuestsError] = useState('');
	const [eventsDebug, setEventsDebug] = useState<DashboardEventListDebug | null>(null);
	const [realtimeState, setRealtimeState] = useState<RealtimeState>('fallback');
	const [inviteBaseUrl, setInviteBaseUrl] = useState('');

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
				console.info('[dashboard][client][loadEvents]', {
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
				console.info('[dashboard][client][loadEvents:error]', error);
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
			const data = await guestsApi.list({ eventId });
			setItems(data.items);
			setTotals(data.totals);
			if (data.shareTemplates) {
				setShareTemplates(data.shareTemplates);
			}
			if (data.reminderSettings) {
				setReminderSettings(resolveReminderSettings(data.reminderSettings));
			}
			setShareDateContext(data.shareDateContext);
			setUpdatedAt(data.updatedAt);
		} catch (error) {
			if (shouldLogDashboardDebug()) {
				console.info('[dashboard][client][loadGuests:error]', {
					eventId,
					error,
					eventsDebug,
				});
			}
			setGuestsError(
				error instanceof Error ? error.message : 'Error de red al cargar invitados.',
			);
		} finally {
			setLoading(false);
		}
	}, [eventId, eventsDebug]);

	const setupPolling = useCallback(() => {
		if (!eventId) return () => {};

		// Initial connection simulated.
		setRealtimeState('connected');

		const pollId = window.setInterval(() => {
			void loadGuests();
		}, DASHBOARD_POLLING_INTERVAL_MS);

		return () => {
			window.clearInterval(pollId);
		};
	}, [eventId, loadGuests]);

	useEffect(() => {
		void loadEvents();
	}, [loadEvents]);

	useEffect(() => {
		void loadGuests();
	}, [loadGuests]);

	useEffect(() => {
		try {
			setInviteBaseUrl(window.location.origin);
			if (eventId) {
				window.localStorage.setItem('rsvp-dashboard-event-id', eventId);
			}
		} catch (err) {
			console.error('[GuestDashboard] client init error:', err);
		}
	}, [eventId]);

	useEffect(() => {
		const cleanup = setupPolling();
		return () => {
			cleanup();
		};
	}, [setupPolling]);

	return {
		error: eventsError || guestsError,
		eventId,
		hostEvents,
		inviteBaseUrl,
		items,
		loading,
		loadGuests,
		realtimeState,
		reminderSettings,
		setEventId,
		setItems,
		setReminderSettings,
		setShareTemplates,
		shareTemplates,
		shareDateContext,
		totals,
		updatedAt,
	};
};
