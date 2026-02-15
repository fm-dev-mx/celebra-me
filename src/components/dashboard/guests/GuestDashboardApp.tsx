import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GuestFilters from './GuestFilters';
import GuestFormModal from './GuestFormModal';
import GuestStatsCards from './GuestStatsCards';
import GuestTable from './GuestTable';
import type { DashboardGuestItem, DashboardGuestListResponse } from './types';
import '@/styles/invitation/_dashboard-guests.scss';

interface GuestDashboardAppProps {
	initialEventId: string;
}

interface HostEventItem {
	id: string;
	title: string;
	slug: string;
	eventType: string;
}

type RealtimeState = 'connected' | 'reconnecting' | 'fallback';

const DEFAULT_TOTALS: DashboardGuestListResponse['totals'] = {
	total: 0,
	pending: 0,
	confirmed: 0,
	declined: 0,
	viewed: 0,
};

const GuestDashboardApp: React.FC<GuestDashboardAppProps> = ({ initialEventId }) => {
	const [eventId, setEventId] = useState(initialEventId);
	const [hostEvents, setHostEvents] = useState<HostEventItem[]>([]);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'declined'>('all');
	const [items, setItems] = useState<DashboardGuestItem[]>([]);
	const [totals, setTotals] = useState(DEFAULT_TOTALS);
	const [updatedAt, setUpdatedAt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [modalOpen, setModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
	const [editingGuest, setEditingGuest] = useState<DashboardGuestItem | null>(null);
	const [realtimeState, setRealtimeState] = useState<RealtimeState>('fallback');
	const [inviteBaseUrl, setInviteBaseUrl] = useState('');
	const reconnectTimerRef = useRef<number | null>(null);
	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);

	const apiJson = useCallback(
		async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
			const response = await fetch(input, init);
			const payload = (await response.json()) as T & { message?: string };
			if (!response.ok) {
				throw new Error(payload.message || 'Error inesperado.');
			}
			return payload as T;
		},
		[],
	);

	const loadEvents = useCallback(async () => {
		try {
			const data = await apiJson<{ items: HostEventItem[] }>('/api/dashboard/events');
			setHostEvents(data.items);
			const storedEventId = window.localStorage.getItem('rsvp-dashboard-event-id') || '';
			const candidates = [initialEventId, storedEventId, data.items[0]?.id || ''].filter(
				Boolean,
			);
			const nextEventId = candidates.find((candidate) =>
				data.items.some((event) => event.id === candidate),
			);
			if (nextEventId && nextEventId !== eventId) {
				setEventId(nextEventId);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'No se pudieron cargar eventos.';
			setError(message);
		}
	}, [apiJson, eventId, initialEventId]);

	const loadGuests = useCallback(async () => {
		if (!eventId) return;
		setLoading(true);
		setError('');
		try {
			const params = new URLSearchParams({ eventId, search, status });
			const data = await apiJson<DashboardGuestListResponse>(
				`/api/dashboard/guests?${params.toString()}`,
			);
			setItems(data.items);
			setTotals(data.totals);
			setUpdatedAt(data.updatedAt);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Error de red al cargar invitados.';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [apiJson, eventId, search, status]);

	useEffect(() => {
		void loadEvents();
	}, [loadEvents]);

	useEffect(() => {
		void loadGuests();
	}, [loadGuests]);

	useEffect(() => {
		setInviteBaseUrl(window.location.origin);
	}, []);

	useEffect(() => {
		if (!eventId) return;
		window.localStorage.setItem('rsvp-dashboard-event-id', eventId);
	}, [eventId]);

	const connectStream = useCallback(() => {
		if (!eventId) return () => {};
		const streamUrl = `/api/dashboard/guests/stream?eventId=${encodeURIComponent(eventId)}`;
		const source = new EventSource(streamUrl);
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
	}, [loadGuests, realtimeState]);

	const modalTitle = useMemo(
		() =>
			modalMode === 'create' ? 'Nuevo invitado' : `Editar: ${editingGuest?.fullName ?? ''}`,
		[editingGuest?.fullName, modalMode],
	);

	return (
		<section className="dashboard-guests">
			<header className="dashboard-guests__header">
				<h1>Dashboard de invitados</h1>
				<label>
					Evento
					<select value={eventId} onChange={(event) => setEventId(event.target.value)}>
						<option value="">Selecciona un evento</option>
						{hostEvents.map((event) => (
							<option key={event.id} value={event.id}>
								{event.title} ({event.slug})
							</option>
						))}
					</select>
				</label>
			</header>

			<GuestFilters
				search={search}
				status={status}
				onSearchChange={setSearch}
				onStatusChange={setStatus}
				onRefreshClick={loadGuests}
				onCreateClick={() => {
					setModalMode('create');
					setEditingGuest(null);
					setModalOpen(true);
				}}
			/>

			<GuestStatsCards totals={totals} />

			{loading && <p className="dashboard-guests__status">Cargando...</p>}
			{updatedAt && (
				<p className="dashboard-guests__status">
					Ultima actualizacion: {new Date(updatedAt).toLocaleString('es-MX')}
				</p>
			)}
			<p className="dashboard-guests__status">
				Estado realtime:{' '}
				{realtimeState === 'connected'
					? 'Conectado'
					: realtimeState === 'reconnecting'
						? 'Reconectando'
						: 'Fallback activo'}
			</p>
			{error && <p className="dashboard-guests__error">{error}</p>}

			<GuestTable
				items={items}
				inviteBaseUrl={inviteBaseUrl}
				onEdit={(item) => {
					setModalMode('edit');
					setEditingGuest(item);
					setModalOpen(true);
				}}
				onDelete={async (item) => {
					const confirmed = window.confirm(`Eliminar a ${item.fullName}?`);
					if (!confirmed) return;
					await apiJson<{ message: string }>(
						`/api/dashboard/guests/${encodeURIComponent(item.guestId)}`,
						{
							method: 'DELETE',
						},
					);
					await loadGuests();
				}}
				onMarkShared={async (item) => {
					await apiJson<{ item: DashboardGuestItem }>(
						`/api/dashboard/guests/${encodeURIComponent(item.guestId)}/mark-shared`,
						{
							method: 'POST',
						},
					);
					await loadGuests();
				}}
			/>

			<GuestFormModal
				open={modalOpen}
				mode={modalMode}
				initialGuest={editingGuest}
				onClose={() => setModalOpen(false)}
				onSubmit={async (payload) => {
					if (modalMode === 'create') {
						await apiJson<{ item: DashboardGuestItem }>('/api/dashboard/guests', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								eventId,
								fullName: payload.fullName,
								phoneE164: payload.phoneE164,
								maxAllowedAttendees: payload.maxAllowedAttendees,
							}),
						});
					} else if (editingGuest) {
						await apiJson<{ item: DashboardGuestItem }>(
							`/api/dashboard/guests/${encodeURIComponent(editingGuest.guestId)}`,
							{
								method: 'PATCH',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(payload),
							},
						);
					}
					await loadGuests();
				}}
			/>

			{modalOpen && <p className="dashboard-guests__status">{modalTitle}</p>}
		</section>
	);
};

export default GuestDashboardApp;
