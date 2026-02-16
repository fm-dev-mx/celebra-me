import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GuestFilters from './GuestFilters';
import GuestFormModal from './GuestFormModal';
import GuestStatsCards from './GuestStatsCards';
import GuestProgressCard from './GuestProgressCard';
import GuestTable from './GuestTable';
import ImportMagic from './ImportMagic';
import Toast from './Toast';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import { useShortcuts } from '@/hooks/useShortcuts';
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
	const [status, setStatus] = useState<'all' | 'pending' | 'confirmed' | 'declined' | 'viewed'>(
		'all',
	);
	const [items, setItems] = useState<DashboardGuestItem[]>([]);
	const [totals, setTotals] = useState(DEFAULT_TOTALS);
	const [updatedAt, setUpdatedAt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [modalOpen, setModalOpen] = useState(false);
	const [importModalOpen, setImportModalOpen] = useState(false);
	const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
	const [editingGuest, setEditingGuest] = useState<DashboardGuestItem | null>(null);
	const [realtimeState, setRealtimeState] = useState<RealtimeState>('fallback');
	const [notification, setNotification] = useState<{
		message: string;
		type: 'info' | 'success' | 'warning';
	} | null>(null);
	const [inviteBaseUrl, setInviteBaseUrl] = useState('');
	const [isNextActionActive, setIsNextActionActive] = useState(false);
	const [nextActionGuestId, setNextActionGuestId] = useState<string | null>(null);
	const reconnectTimerRef = useRef<number | null>(null);
	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useShortcuts(
		{
			'/': () => searchInputRef.current?.focus(),
			n: () => {
				setModalMode('create');
				setEditingGuest(null);
				setModalOpen(true);
			},
			e: () => {
				if (items.length > 0) {
					setModalMode('edit');
					setEditingGuest(items[0]); // Por ahora editamos el primero si no hay selección explícita
					setModalOpen(true);
				}
			},
			escape: () => {
				setModalOpen(false);
			},
		},
		!modalOpen,
	);

	const apiJson = useCallback(
		async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
			try {
				const response = await fetch(input, init);
				const payload = (await response.json()) as T & { message?: string; error?: string };
				if (!response.ok) {
					const errorMsg = payload.message || payload.error || `Error ${response.status}`;
					console.error('[GuestDashboard API] Error:', response.status, errorMsg);
					throw new Error(errorMsg);
				}
				return payload as T;
			} catch (err) {
				console.error('[GuestDashboard API] Fetch error:', err);
				throw err;
			}
		},
		[],
	);

	const loadEvents = useCallback(async () => {
		try {
			console.info('[GuestDashboard] Loading events...');
			const data = await apiJson<{ items: HostEventItem[] }>('/api/dashboard/events');
			console.info('[GuestDashboard] Events loaded:', data.items.length);
			setHostEvents(data.items);
			const storedEventId = window.localStorage.getItem('rsvp-dashboard-event-id') || '';
			const candidates = [initialEventId, storedEventId, data.items[0]?.id || ''].filter(
				Boolean,
			);
			const nextEventId = candidates.find((candidate) =>
				data.items.some((event) => event.id === candidate),
			);
			if (nextEventId && nextEventId !== eventId) {
				console.info('[GuestDashboard] Setting eventId:', nextEventId);
				setEventId(nextEventId);
			}
		} catch (err) {
			console.error('[GuestDashboard] Error loading events:', err);
			const message = err instanceof Error ? err.message : 'No se pudieron cargar eventos.';
			setError(message);
		}
	}, [apiJson, eventId, initialEventId]);

	const loadGuests = useCallback(async () => {
		if (!eventId) {
			console.info('[GuestDashboard] No eventId, skipping loadGuests');
			return;
		}
		setLoading(true);
		setError('');
		try {
			console.info('[GuestDashboard] Loading guests for event:', eventId);
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
		try {
			void loadEvents();
		} catch (err) {
			console.error('[GuestDashboard] useEffect loadEvents error:', err);
		}
	}, [loadEvents]);

	useEffect(() => {
		try {
			void loadGuests();
		} catch (err) {
			console.error('[GuestDashboard] useEffect loadGuests error:', err);
		}
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
			setNotification({ message: 'Cambios detectados en los invitados.', type: 'info' });
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
		<ErrorBoundary>
			<section className="dashboard-guests">
				<header className="dashboard-guests__header">
					<h1>Dashboard de invitados</h1>
					<label>
						Evento
						<select
							value={eventId}
							onChange={(event) => setEventId(event.target.value)}
						>
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
					searchInputRef={searchInputRef}
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
					onExportClick={async () => {
						try {
							const response = await fetch(
								`/api/dashboard/guests/export.csv?eventId=${encodeURIComponent(eventId)}`,
							);
							if (!response.ok) throw new Error('Error al exportar CSV');
							const blob = await response.blob();
							const url = window.URL.createObjectURL(blob);
							const a = document.createElement('a');
							a.href = url;
							a.download = `invitados-${eventId}.csv`;
							document.body.appendChild(a);
							a.click();
							window.URL.revokeObjectURL(url);
							document.body.removeChild(a);
						} catch (err) {
							console.error('[GuestDashboard] Export error:', err);
							setNotification({
								message: 'Error al exportar invitados.',
								type: 'warning',
							});
						}
					}}
					onImportClick={() => setImportModalOpen(true)}
				/>

				<div className="dashboard-guests__quick-actions">
					{items.some((i) => i.deliveryStatus === 'generated') && (
						<button
							className="btn-primary btn--shiny"
							disabled={loading}
							onClick={() => {
								const next = items.find((i) => i.deliveryStatus === 'generated');
								if (next) {
									setModalMode('edit');
									setEditingGuest(next);
									setIsNextActionActive(true);
									setNextActionGuestId(next.guestId);
									setModalOpen(true);
								}
							}}
						>
							🚀 Enviar Siguiente (
							{items.filter((i) => i.deliveryStatus === 'generated').length}{' '}
							pendientes)
						</button>
					)}
				</div>

				<GuestProgressCard
					total={totals.total}
					shared={items.filter((i) => i.deliveryStatus === 'shared').length}
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
						setNotification({
							message: `Invitado ${item.fullName} eliminado.`,
							type: 'info',
						});
					}}
					onMarkShared={async (item) => {
						// Optimistic Update
						const previousItems = [...items];
						setItems((prev) =>
							prev.map((i) =>
								i.guestId === item.guestId ? { ...i, deliveryStatus: 'shared' } : i,
							),
						);
						try {
							await apiJson<{ item: DashboardGuestItem }>(
								`/api/dashboard/guests/${encodeURIComponent(item.guestId)}/mark-shared`,
								{
									method: 'POST',
								},
							);
							await loadGuests();
							setNotification({
								message: 'Invitación marcada como enviada.',
								type: 'success',
							});
						} catch (err) {
							console.error('[GuestDashboard] Mark shared error:', err);
							// Rollback
							setItems(previousItems);
							setNotification({
								message: 'Error al actualizar el estado de envío.',
								type: 'warning',
							});
						}
					}}
				/>

				<GuestFormModal
					open={modalOpen}
					mode={modalMode}
					initialGuest={editingGuest}
					onClose={() => setModalOpen(false)}
					onSubmit={async (payload, stayOpen) => {
						let savedItem: DashboardGuestItem | null = null;
						if (modalMode === 'create') {
							const response = await apiJson<{ item: DashboardGuestItem }>(
								'/api/dashboard/guests',
								{
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										eventId,
										fullName: payload.fullName,
										phoneE164: payload.phoneE164,
										maxAllowedAttendees: payload.maxAllowedAttendees,
										tags: payload.tags,
									}),
								},
							);
							savedItem = response.item;
						} else if (editingGuest) {
							const response = await apiJson<{ item: DashboardGuestItem }>(
								`/api/dashboard/guests/${encodeURIComponent(editingGuest.guestId)}`,
								{
									method: 'PATCH',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(payload),
								},
							);
							savedItem = response.item;
						}

						await loadGuests();

						setNotification({
							message: `Invitado ${savedItem?.fullName || 'guardado'} correctamente.`,
							type: 'success',
						});

						// Handle auto-share logic for "Send Next" flow
						if (isNextActionActive && modalMode === 'edit' && savedItem) {
							const guestId = savedItem.guestId;
							setTimeout(() => {
								const waButton = document.querySelector(
									`tr[data-guest-id="${guestId}"] .dashboard-guests__wa-button`,
								) as HTMLElement;
								if (waButton) {
									waButton.click();
									const row = document.querySelector(
										`tr[data-guest-id="${guestId}"]`,
									);
									row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
								}
								setIsNextActionActive(false);
								setNextActionGuestId(null);
							}, 400);
						}
					}}
				/>

				{modalOpen && <p className="dashboard-guests__status">{modalTitle}</p>}

				{notification && (
					<Toast
						message={notification.message}
						type={notification.type}
						onClose={() => setNotification(null)}
						action={{
							label: 'Actualizar',
							onClick: () => {
								void loadGuests();
								setNotification(null);
							},
						}}
					/>
				)}

				{importModalOpen && (
					<ImportMagic
						onClose={() => setImportModalOpen(false)}
						onImport={async (guests) => {
							await apiJson('/api/dashboard/guests/bulk', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									eventId,
									guests: guests.map((g) => ({
										full_name: g.fullName,
										phone_e164: g.phoneE164,
										email: g.email,
										tags: g.tags,
									})),
								}),
							});
							await loadGuests();
						}}
					/>
				)}
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
