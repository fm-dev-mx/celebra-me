import type { FC } from 'react';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import OverflowMenu from '@/components/dashboard/intake/OverflowMenu';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import ModalShell from '@/components/dashboard/ModalShell';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { resolveDisplayInfo, hasInconsistency } from '@/lib/intake/display-status';
import { getPublicSlug } from '@/lib/intake/slug';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

type FilterTab =
	| 'all'
	| 'clients'
	| 'demos'
	| 'drafts'
	| 'waiting_for_client'
	| 'capture_received'
	| 'in_review'
	| 'published'
	| 'archived'
	| 'needs_attention';

const FILTER_TABS: Array<{
	key: FilterTab;
	label: string;
	match: (invitation: InvitationDTO) => boolean;
	isPrimary: boolean;
}> = [
	{ key: 'all', label: 'Todas', match: (invitation) => !invitation.archivedAt, isPrimary: true },
	{
		key: 'clients',
		label: 'Invitaciones',
		match: (invitation) => invitation.kind === 'client' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'demos',
		label: 'Demos',
		match: (invitation) => invitation.kind === 'demo' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'drafts',
		label: 'Borradores',
		match: (invitation) => invitation.status === 'draft' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'waiting_for_client',
		label: 'Esperando cliente',
		match: (invitation) => invitation.status === 'waiting_for_client' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'capture_received',
		label: 'Captura recibida',
		match: (invitation) => invitation.status === 'client_submitted' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'in_review',
		label: 'En revisión',
		match: (invitation) => invitation.status === 'in_review' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'published',
		label: 'Publicadas',
		match: (invitation) => invitation.status === 'published' && !invitation.archivedAt,
		isPrimary: true,
	},
	{
		key: 'archived',
		label: 'Archivadas',
		match: (invitation) => Boolean(invitation.archivedAt),
		isPrimary: false,
	},
	{
		key: 'needs_attention',
		label: 'Requieren atención',
		match: (invitation) => hasInconsistency(invitation) && !invitation.archivedAt,
		isPrimary: false,
	},
];

function publicUrl(invitation: InvitationDTO): string | null {
	if (!invitation.published) return null;
	return `/${invitation.eventType}/${getPublicSlug(invitation)}`;
}

function relativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Hoy';
	if (diffDays === 1) return 'Ayer';
	if (diffDays < 7) return `Hace ${diffDays} días`;
	if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
	return date.toLocaleDateString('es-MX');
}

interface InvitationTableRowProps {
	invitation: InvitationDTO;
	onArchive: (invitation: InvitationDTO) => void;
	onRestore: (invitation: InvitationDTO) => void;
	onPermanentDelete: (invitation: InvitationDTO) => void;
	onDuplicateOpen: (invitation: InvitationDTO) => void;
}

const InvitationTableRow: FC<InvitationTableRowProps> = ({
	invitation,
	onArchive,
	onRestore,
	onPermanentDelete,
	onDuplicateOpen,
}) => {
	const displayInfo = resolveDisplayInfo(invitation);
	const publishedUrl = publicUrl(invitation);
	const isActive = !invitation.archivedAt;
	const isDemo = invitation.kind === 'demo';

	const copyPublicLink = useCallback(() => {
		if (publishedUrl) {
			void navigator.clipboard.writeText(`${window.location.origin}${publishedUrl}`);
		}
	}, [publishedUrl]);

	const copyCaptureLink = useCallback(() => {
		if (invitation.captureUrl) {
			void navigator.clipboard.writeText(invitation.captureUrl);
		}
	}, [invitation.captureUrl]);

	return (
		<tr className={isDemo ? 'intake-list__row--demo' : ''}>
			<td className="intake-list__cell-title">
				<a href={invitation.internalEditUrl} className="intake-list__title-link">
					{invitation.title}
				</a>
			</td>
			<td className="intake-list__cell-client">{invitation.clientName || '\u2014'}</td>
			<td className="intake-list__cell-status">
				<div className="intake-list__status-group">
					<StatusBadge variant={displayInfo.variant} label={displayInfo.label} />
					{isDemo && <span className="intake-list__demo-badge">Demo</span>}
					{displayInfo.warning && (
						<span className="intake-list__status-warning" title={displayInfo.warning}>
							⚠
						</span>
					)}
				</div>
			</td>
			<td
				className="intake-list__cell-date"
				title={new Date(invitation.updatedAt).toLocaleString('es-MX')}
			>
				{relativeDate(invitation.updatedAt)}
			</td>
			<td className="intake-list__cell-actions">
				<div className="intake-list__action-group">
					{isActive && (
						<a href={invitation.internalEditUrl} className="intake-list__action-edit">
							Editar
						</a>
					)}
					{publishedUrl && isActive && (
						<a
							href={publishedUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="intake-list__action-view"
						>
							Vista
						</a>
					)}
					<OverflowMenu
						items={[
							{
								label: 'Duplicar',
								hidden: !isDemo || !isActive,
								onClick: () => onDuplicateOpen(invitation),
							},
							{
								label: 'Copiar enlace público',
								hidden: !publishedUrl || !isActive,
								onClick: copyPublicLink,
							},
							{
								label: 'Copiar enlace de captura',
								hidden: !invitation.captureUrl || !isActive,
								onClick: copyCaptureLink,
							},
							{
								label: 'Link cliente',
								hidden: isDemo || !isActive || Boolean(invitation.captureUrl),
								onClick: () => {
									window.location.href = `/dashboard/invitaciones/${invitation.id}`;
								},
							},
							{
								label: 'Archivar',
								hidden: !isActive,
								onClick: () => onArchive(invitation),
							},
							{
								label: 'Restaurar',
								hidden: isActive,
								onClick: () => onRestore(invitation),
							},
							{
								label: 'Eliminar permanentemente',
								hidden: isActive,
								destructive: true,
								onClick: () => onPermanentDelete(invitation),
							},
						]}
					/>
				</div>
			</td>
		</tr>
	);
};

const EMPTY_STATE_MESSAGES: Record<FilterTab, { message: string; action?: boolean }> = {
	all: {
		message: 'No hay invitaciones activas. Crea una nueva invitación para comenzar.',
		action: true,
	},
	clients: { message: 'No hay invitaciones de clientes activas.', action: true },
	demos: { message: 'No hay demos disponibles.', action: false },
	drafts: { message: 'No hay borradores.', action: false },
	waiting_for_client: {
		message: 'No hay invitaciones esperando respuesta del cliente.',
		action: false,
	},
	capture_received: {
		message: 'No hay capturas recibidas pendientes de revisión.',
		action: false,
	},
	in_review: { message: 'No hay invitaciones en revisión.', action: false },
	published: { message: 'No hay invitaciones publicadas.', action: false },
	archived: { message: 'No hay invitaciones archivadas.', action: false },
	needs_attention: { message: 'No hay invitaciones que requieran atención.', action: false },
};

const EmptyStateWithAction: FC<{ tab: FilterTab }> = ({ tab }) => {
	const info = EMPTY_STATE_MESSAGES[tab];
	return (
		<EmptyState
			message={info.message}
			action={
				info.action ? (
					<a href="/dashboard/invitaciones/nueva" className="intake-list__create-btn">
						Nueva invitación
					</a>
				) : undefined
			}
		/>
	);
};

const InvitationList: FC = () => {
	const {
		items,
		loading,
		error,
		archiveInvitation,
		restoreInvitation,
		permanentlyDeleteInvitation,
		duplicateInvitationFromDemo,
	} = useInvitationAdmin();
	const [actionError, setActionError] = useState('');
	const [activeTab, setActiveTab] = useState<FilterTab>('all');

	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		searchTimerRef.current = setTimeout(() => {
			setDebouncedSearch(searchQuery);
		}, 300);
		return () => {
			if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
		};
	}, [searchQuery]);

	const [confirmState, setConfirmState] = useState<{
		type: 'archive' | 'restore' | 'delete';
		invitation: InvitationDTO;
	} | null>(null);

	const [duplicateTarget, setDuplicateTarget] = useState<{
		invitation: InvitationDTO;
		title: string;
	} | null>(null);

	const tabFiltered = useMemo(() => {
		const tab = FILTER_TABS.find((item) => item.key === activeTab);
		return tab ? items.filter(tab.match) : items;
	}, [items, activeTab]);

	const filteredItems = useMemo(() => {
		if (!debouncedSearch) return tabFiltered;
		const q = debouncedSearch.toLowerCase();
		return tabFiltered.filter(
			(invitation) =>
				invitation.title.toLowerCase().includes(q) ||
				(invitation.clientName && invitation.clientName.toLowerCase().includes(q)),
		);
	}, [tabFiltered, debouncedSearch]);

	const metrics = useMemo(() => {
		const active = items.filter((i) => !i.archivedAt);
		return {
			total: active.length,
			published: active.filter((i) => i.status === 'published').length,
			drafts: active.filter((i) => i.status === 'draft').length,
			archived: items.filter((i) => i.archivedAt).length,
		};
	}, [items]);

	const runAction = async (action: () => Promise<unknown>, fallback: string) => {
		setActionError('');
		try {
			await action();
		} catch (err) {
			setActionError(toErrorMessage(err, fallback));
		}
	};

	const handleArchive = (invitation: InvitationDTO) => {
		setConfirmState({ type: 'archive', invitation });
	};

	const handleRestore = (invitation: InvitationDTO) => {
		setConfirmState({ type: 'restore', invitation });
	};

	const handlePermanentDelete = (invitation: InvitationDTO) => {
		setConfirmState({ type: 'delete', invitation });
	};

	const handleDuplicateOpen = (invitation: InvitationDTO) => {
		setDuplicateTarget({ invitation, title: `${invitation.title} - copia` });
	};

	const executeConfirm = async () => {
		if (!confirmState) return;
		const { type, invitation } = confirmState;

		if (type === 'archive') {
			await runAction(
				() => archiveInvitation(invitation.id),
				'No se pudo archivar la invitación.',
			);
		} else if (type === 'restore') {
			await runAction(
				() => restoreInvitation(invitation.id),
				'No se pudo restaurar la invitación.',
			);
		} else if (type === 'delete') {
			await runAction(
				() => permanentlyDeleteInvitation(invitation.id),
				'No se pudo eliminar definitivamente la invitación.',
			);
		}
		setConfirmState(null);
	};

	const handleDuplicateConfirm = async () => {
		if (!duplicateTarget?.title.trim()) return;
		await runAction(async () => {
			const created = await duplicateInvitationFromDemo(duplicateTarget.invitation.id, {
				title: duplicateTarget.title.trim(),
			});
			window.location.href = `/dashboard/invitaciones/${created.id}/editar`;
		}, 'No se pudo duplicar el demo.');
		setDuplicateTarget(null);
	};

	return (
		<div className="intake-list">
			<header className="intake-list__header">
				<div>
					<h2 className="intake-list__title">Producción de invitaciones</h2>
					<p className="intake-list__subtitle">
						Administra invitaciones y demos editables desde un solo lugar.
					</p>
				</div>
				<a href="/dashboard/invitaciones/nueva" className="intake-list__create-btn">
					Nueva invitación
				</a>
			</header>

			{error && <p className="intake-list__error">{error}</p>}
			{actionError && <p className="intake-list__error">{actionError}</p>}

			<div
				className={`intake-list__metrics${loading ? ' intake-list__metrics--loading' : ''}`}
			>
				<span className="intake-list__metric">
					<span className="intake-list__metric-value">{metrics.total}</span>
					<span className="intake-list__metric-label">Activas</span>
				</span>
				<span className="intake-list__metric">
					<span className="intake-list__metric-value">{metrics.published}</span>
					<span className="intake-list__metric-label">Publicadas</span>
				</span>
				<span className="intake-list__metric">
					<span className="intake-list__metric-value">{metrics.drafts}</span>
					<span className="intake-list__metric-label">Borradores</span>
				</span>
				<span className="intake-list__metric">
					<span className="intake-list__metric-value">{metrics.archived}</span>
					<span className="intake-list__metric-label">Archivadas</span>
				</span>
			</div>

			<div className="intake-list__toolbar">
				<div className="intake-list__search">
					<input
						type="text"
						className="intake-list__search-input"
						placeholder="Buscar por título o cliente..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						aria-label="Buscar invitaciones"
					/>
					{searchQuery && (
						<button
							type="button"
							className="intake-list__search-clear"
							onClick={() => setSearchQuery('')}
							aria-label="Limpiar búsqueda"
						>
							×
						</button>
					)}
				</div>
			</div>

			<nav className="intake-list__tabs">
				{FILTER_TABS.map((tab) => {
					const count = items.filter(tab.match).length;
					return (
						<button
							key={tab.key}
							type="button"
							className={`intake-list__tab${activeTab === tab.key ? ' intake-list__tab--active' : ''}${!tab.isPrimary ? ' intake-list__tab--secondary' : ''}`}
							onClick={() => setActiveTab(tab.key)}
						>
							{tab.label}
							{count > 0 && <span className="intake-list__tab-count">{count}</span>}
						</button>
					);
				})}
			</nav>

			{loading ? (
				<div className="intake-list__loading">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="intake-list__skeleton-row" />
					))}
				</div>
			) : filteredItems.length === 0 ? (
				<EmptyStateWithAction tab={activeTab} />
			) : (
				<div className="intake-list__table-wrap">
					<table className="intake-list__table">
						<thead>
							<tr>
								<th>Invitación</th>
								<th>Cliente</th>
								<th>Estado</th>
								<th>Actualizado</th>
								<th>Acciones</th>
							</tr>
						</thead>
						<tbody>
							{filteredItems.map((invitation) => (
								<InvitationTableRow
									key={invitation.id}
									invitation={invitation}
									onArchive={handleArchive}
									onRestore={handleRestore}
									onPermanentDelete={handlePermanentDelete}
									onDuplicateOpen={handleDuplicateOpen}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}

			{confirmState &&
				(() => {
					const CONFIRM_CONFIGS = {
						archive: {
							title: 'Archivar invitación',
							message:
								'La invitación dejará de aparecer en la lista activa. Puedes restaurarla después.',
							confirmLabel: 'Archivar',
						},
						restore: {
							title: 'Restaurar invitación',
							message: 'La invitación volverá a aparecer en la lista activa.',
							confirmLabel: 'Restaurar',
						},
						delete: {
							title: 'Eliminar permanentemente',
							message:
								'Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a esta invitación.',
							confirmLabel: 'Eliminar definitivamente',
							destructive: true,
						},
					} as const;
					const config = CONFIRM_CONFIGS[confirmState.type];
					return (
						<ConfirmModal
							title={config.title}
							message={config.message}
							confirmLabel={config.confirmLabel}
							destructive={'destructive' in config ? true : undefined}
							onConfirm={executeConfirm}
							onCancel={() => setConfirmState(null)}
						/>
					);
				})()}

			{duplicateTarget && (
				<ModalShell title="Duplicar demo" onClose={() => setDuplicateTarget(null)}>
					<div className="confirm-modal__body">
						<p className="confirm-modal__message">
							Nueva invitación a partir de "{duplicateTarget.invitation.title}"
						</p>
						<div className="intake-field create-flow__field-spacing">
							<label className="intake-field__label" htmlFor="dup-title">
								Título de la nueva invitación
							</label>
							<input
								id="dup-title"
								className="intake-field__input"
								value={duplicateTarget.title}
								onChange={(e) =>
									setDuplicateTarget((prev) =>
										prev ? { ...prev, title: e.target.value } : null,
									)
								}
							/>
						</div>
					</div>
					<div className="confirm-modal__actions">
						<button
							type="button"
							className="btn-secondary"
							onClick={() => setDuplicateTarget(null)}
						>
							Cancelar
						</button>
						<button
							type="button"
							className="btn-primary"
							disabled={!duplicateTarget.title.trim()}
							onClick={handleDuplicateConfirm}
						>
							Duplicar
						</button>
					</div>
				</ModalShell>
			)}
		</div>
	);
};

export default InvitationList;
