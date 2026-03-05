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
import { createPortal } from 'react-dom';
import { Confetti } from '@/components/ui/Confetti';

import { guestsApi } from '@/lib/dashboard/guests-api';

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

const GuestDashboardApp: React.FC<GuestDashboardAppProps> = ({ initialEventId }) => {
	const [eventId, setEventId] = useState<string>(initialEventId || '');
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
	const [shareSessionCount, setShareSessionCount] = useState(0);
	const [isNextActionActive, setIsNextActionActive] = useState(false);
	const reconnectTimerRef = useRef<number | null>(null);
	const refreshDebounceRef = useRef<number | null>(null);
	const reconnectAttemptRef = useRef(0);
	const [confettiActive, setConfettiActive] = useState(false);
	const [celebratingGuestId, setCelebratingGuestId] = useState<string | null>(null);
	const [highlightedGuestId, setHighlightedGuestId] = useState<string | null>(null);
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

	const loadEvents = useCallback(async () => {
		try {
			console.info('[GuestDashboard] Loading events...');
			const data = await guestsApi.listEvents();
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
			const message = err instanceof Error ? err.message : 'No se pudieron cargar eventos.';
			setError(message);
		}
	}, [eventId, initialEventId]);

	const loadGuests = useCallback(async () => {
		if (!eventId) {
			console.info('[GuestDashboard] No eventId, skipping loadGuests');
			return;
		}
		setLoading(true);
		setError('');
		try {
			console.info('[GuestDashboard] Loading guests for event:', eventId);
			const data = await guestsApi.list({ eventId, search, status });
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
	}, [eventId, search, status]);

	useEffect(() => {
		try {
			void loadEvents();
		} catch {
			// Errors from loadEvents are already handled within the function
		}
	}, [loadEvents]);

	useEffect(() => {
		try {
			void loadGuests();
		} catch {
			// Errors from loadGuests are already handled within the function
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
		const source = new EventSource(streamUrl, { withCredentials: true });
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

	const sortedItems = useMemo(() => {
		return [...items].sort((a, b) => {
			// 1. Pending (generated) first
			if (a.deliveryStatus === 'generated' && b.deliveryStatus === 'shared') return -1;
			if (a.deliveryStatus === 'shared' && b.deliveryStatus === 'generated') return 1;

			// 2. Then within same delivery status, sort by name or creation?
			// Let's keep existing order for same status
			return 0;
		});
	}, [items]);

	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [guestToDelete, setGuestToDelete] = useState<DashboardGuestItem | null>(null);

	const handleDeleteConfirm = async () => {
		if (!guestToDelete) return;
		setLoading(true);
		try {
			await guestsApi.delete(guestToDelete.guestId);
			await loadGuests();
			setNotification({
				message: `Invitado ${guestToDelete.fullName} eliminado con éxito.`,
				type: 'success',
			});
		} catch {
			setNotification({
				message: 'Error al eliminar invitado.',
				type: 'warning',
			});
		} finally {
			setLoading(false);
			setDeleteConfirmOpen(false);
			setGuestToDelete(null);
		}
	};

	// Unified Modal Scroll Lock (Robust CSS-class based)
	useEffect(() => {
		const isAnyModalOpen = modalOpen || deleteConfirmOpen || importModalOpen;

		if (isAnyModalOpen) {
			document.body.classList.add('modal-open');
		} else {
			document.body.classList.remove('modal-open');
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.top = '';
		}

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isAnyModalOpen) {
				setModalOpen(false);
				setDeleteConfirmOpen(false);
				setImportModalOpen(false);
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [modalOpen, deleteConfirmOpen, importModalOpen]);

	const handlePostpone = useCallback(() => {
		if (!editingGuest) return;

		setItems((prev) => {
			const index = prev.findIndex((i) => i.guestId === editingGuest.guestId);
			if (index === -1) return prev;

			const newItems = [...prev];
			const [postponedItem] = newItems.splice(index, 1);
			newItems.push(postponedItem);
			return newItems;
		});

		// Find the NEXT guest to edit (after the local state update is potentially queued)
		const remainingPending = items.filter(
			(i) => i.deliveryStatus === 'generated' && i.guestId !== editingGuest.guestId,
		);

		if (remainingPending.length > 0) {
			setEditingGuest(remainingPending[0]);
			setNotification({
				message: `Invitado pospuesto. Siguiente: ${remainingPending[0].fullName}`,
				type: 'info',
			});
		} else {
			setModalOpen(false);
			setIsNextActionActive(false);
			setNotification({
				message: 'No hay más invitados pendientes en la cola.',
				type: 'info',
			});
		}
	}, [editingGuest, items]);

	return (
		<ErrorBoundary>
			<section className="dashboard-guests">
				<Confetti active={confettiActive} onComplete={() => setConfettiActive(false)} />

				<div className="dashboard-guests__toolbar">
					<div className="dashboard-guests__title-area">
						<h1>Dashboard de invitados</h1>
						<div className="header-event-selector">
							<label htmlFor="active-event">Evento activo</label>
							<select
								id="active-event"
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
						</div>
					</div>
				</div>

				<div className="dashboard-guests__meta-bar">
					{updatedAt && (
						<span className="dashboard-guests__status">
							<span>🕒</span> Actualizado:{' '}
							{new Date(updatedAt).toLocaleString('es-MX')}
						</span>
					)}
					<span className="dashboard-guests__status">
						<span>📡</span> Streaming:{' '}
						{realtimeState === 'connected' ? '✅ Conectado' : '🔄 Reconectando'}
					</span>
				</div>

				<GuestProgressCard
					totalPeople={totals.totalPeople}
					confirmedPeople={totals.confirmedPeople}
					sessionCount={shareSessionCount}
				/>

				<GuestStatsCards totals={totals} />

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
							const query = new URLSearchParams({ eventId });
							const response = await fetch(
								`/api/dashboard/guests/export.csv?${query.toString()}`,
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

				{loading && <p className="dashboard-guests__status">Procesando...</p>}

				{error && <p className="dashboard-guests__error">{error}</p>}

				<GuestTable
					items={sortedItems}
					inviteBaseUrl={inviteBaseUrl}
					celebratingGuestId={celebratingGuestId}
					highlightedGuestId={highlightedGuestId}
					onEdit={(item) => {
						setModalMode('edit');
						setEditingGuest(item);
						setModalOpen(true);
					}}
					onDelete={async (item) => {
						setGuestToDelete(item);
						setDeleteConfirmOpen(true);
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
							await guestsApi.markShared(item.guestId);

							setShareSessionCount((prev) => prev + 1);
							setConfettiActive(true);
							setNotification({
								message: '¡Invitación compartida! 🎉',
								type: 'success',
							});

							// Trigger celebration animation on the table row
							setCelebratingGuestId(item.guestId);
							setTimeout(() => setCelebratingGuestId(null), 1500);

							await loadGuests();

							// Smart Focus: Highlight next guest
							const currentIndex = items.findIndex((i) => i.guestId === item.guestId);
							if (currentIndex !== -1 && currentIndex < items.length - 1) {
								const nextGuest = items[currentIndex + 1];
								setTimeout(() => {
									setHighlightedGuestId(nextGuest.guestId);
									setTimeout(() => setHighlightedGuestId(null), 2000);
								}, 800);
							}
						} catch (err) {
							console.error('[GuestDashboard] Mark shared error:', err);
							setItems(previousItems);
							setNotification({
								message: 'Error al actualizar estado.',
								type: 'warning',
							});
						}
					}}
				/>

				{deleteConfirmOpen &&
					createPortal(
						<div
							className="dashboard-modal-backdrop"
							onClick={() => setDeleteConfirmOpen(false)}
							role="presentation"
						>
							<div
								className="dashboard-modal dashboard-modal--confirm"
								onClick={(e) => e.stopPropagation()}
								role="dialog"
								aria-modal="true"
								aria-labelledby="delete-modal-title"
							>
								<div className="dashboard-modal__header">
									<h3 id="delete-modal-title">Confirmar eliminación</h3>
									<button
										className="btn-close"
										onClick={() => setDeleteConfirmOpen(false)}
										aria-label="Cerrar modal"
									>
										&times;
									</button>
								</div>

								<div className="dashboard-modal__content">
									<p className="dashboard-modal__confirm-text">
										¿Estás seguro de que deseas eliminar a{' '}
										<strong>{guestToDelete?.fullName}</strong>?
									</p>

									<p className="dashboard-modal__confirm-warning">
										Esta acción no se puede deshacer.
									</p>
								</div>

								<div className="dashboard-modal__footer">
									<button
										type="button"
										className="btn-secondary"
										onClick={() => setDeleteConfirmOpen(false)}
									>
										Cancelar
									</button>

									<button
										type="button"
										className="btn-primary btn-primary--danger"
										onClick={handleDeleteConfirm}
									>
										Eliminar definitivamente
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)}
				{modalOpen && (
					<GuestFormModal
						open={modalOpen}
						mode={modalMode}
						initialGuest={editingGuest}
						isInvitationFactory={isNextActionActive}
						onClose={() => {
							setModalOpen(false);
							setIsNextActionActive(false);
						}}
						onPostpone={handlePostpone}
						onSubmit={async (payload, stayOpen) => {
							let savedItem: DashboardGuestItem | null = null;
							try {
								if (modalMode === 'create') {
									savedItem = await guestsApi.create({
										eventId,
										...payload,
									});
								} else if (editingGuest) {
									savedItem = await guestsApi.update(
										editingGuest.guestId,
										payload,
									);
								}

								await loadGuests();

								setNotification({
									message: `Invitado ${savedItem?.fullName || 'guardado'} correctamente.`,
									type: 'success',
								});

								if (isNextActionActive && modalMode === 'edit' && savedItem) {
									const guestId = savedItem.guestId;
									setTimeout(() => {
										const shareButton = document.querySelector(
											`[data-guest-id="${guestId}"] .dashboard-guests__share-button`,
										) as HTMLElement;
										if (shareButton) {
											shareButton.click();
											const card = document.querySelector(
												`[data-guest-id="${guestId}"]`,
											);
											card?.scrollIntoView({
												behavior: 'smooth',
												block: 'center',
											});
										}
										setIsNextActionActive(false);
									}, 400);
								}

								if (!stayOpen) {
									setModalOpen(false);
									setIsNextActionActive(false);
								}
							} catch (err) {
								console.error('Error saving guest:', err);
								throw err;
							}
						}}
					/>
				)}

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
							await guestsApi.bulkImport({
								eventId,
								guests: guests.map((g) => ({
									full_name: g.fullName || '',
									phone_: g.phone,
									email: g.email,
									tags: g.tags,
								})),
							});
							await loadGuests();
						}}
					/>
				)}

				{/* Mobile Action Dock - Portaled for permanent visibility */}
				{typeof document !== 'undefined' &&
					createPortal(
						<div className="dashboard-guests__mobile-dock">
							<button
								className="dock-item"
								onClick={() => {
									setModalMode('create');
									setEditingGuest(null);
									setModalOpen(true);
								}}
							>
								<span className="dock-icon">➕</span>
								<span className="dock-label">Nuevo</span>
							</button>

							<button
								className="dock-item dock-item--main"
								disabled={
									loading || !items.some((i) => i.deliveryStatus === 'generated')
								}
								onClick={() => {
									const next = items.find(
										(i) => i.deliveryStatus === 'generated',
									);
									if (next) {
										setModalMode('edit');
										setEditingGuest(next);
										setIsNextActionActive(true);
										setModalOpen(true);
									}
								}}
							>
								<span className="dock-icon">🚀</span>
								<span className="dock-label">Siguiente</span>
							</button>

							<div className="dock-item dock-item--filter">
								<select
									value={status}
									onChange={(e) => setStatus(e.target.value as typeof status)}
								>
									<option value="all">Filtrar</option>
									<option value="pending">⏳ Pend.</option>
									<option value="confirmed">✅ Conf.</option>
									<option value="declined">❌ Decl.</option>
								</select>
								<span className="dock-label">Estado</span>
							</div>
						</div>,
						document.body,
					)}
			</section>
		</ErrorBoundary>
	);
};

export default GuestDashboardApp;
