import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DemoSelector from '@/components/dashboard/intake/DemoSelector';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { resolveDisplayInfo, hasInconsistency } from '@/lib/intake/display-status';
import { EVENT_TYPE_LABELS } from '@/lib/intake/labels';
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
}> = [
	{ key: 'all', label: 'Todas', match: (invitation) => !invitation.archivedAt },
	{
		key: 'clients',
		label: 'Invitaciones',
		match: (invitation) => invitation.kind === 'client' && !invitation.archivedAt,
	},
	{
		key: 'demos',
		label: 'Demos',
		match: (invitation) => invitation.kind === 'demo' && !invitation.archivedAt,
	},
	{
		key: 'drafts',
		label: 'Borradores',
		match: (invitation) => invitation.status === 'draft' && !invitation.archivedAt,
	},
	{
		key: 'waiting_for_client',
		label: 'Esperando cliente',
		match: (invitation) => invitation.status === 'waiting_for_client' && !invitation.archivedAt,
	},
	{
		key: 'capture_received',
		label: 'Captura recibida',
		match: (invitation) => invitation.status === 'client_submitted' && !invitation.archivedAt,
	},
	{
		key: 'in_review',
		label: 'En revisión',
		match: (invitation) => invitation.status === 'in_review' && !invitation.archivedAt,
	},
	{
		key: 'published',
		label: 'Publicadas',
		match: (invitation) => invitation.status === 'published' && !invitation.archivedAt,
	},
	{ key: 'archived', label: 'Archivadas', match: (invitation) => Boolean(invitation.archivedAt) },
	{
		key: 'needs_attention',
		label: 'Requieren atención',
		match: (invitation) => hasInconsistency(invitation) && !invitation.archivedAt,
	},
];

function publicUrl(invitation: InvitationDTO): string | null {
	if (!invitation.published) return null;
	return `/${invitation.eventType}/${invitation.slug ?? `${invitation.eventType}-${invitation.id.slice(0, 8)}`}`;
}

interface InvitationTableRowProps {
	invitation: InvitationDTO;
	onArchive: (invitation: InvitationDTO) => void;
	onRestore: (invitation: InvitationDTO) => void;
	onPermanentDelete: (invitation: InvitationDTO) => void;
	onDuplicate: (invitation: InvitationDTO) => void;
}

function contentSummary(invitation: InvitationDTO): string {
	if (invitation.published) return 'Publicado';
	if (invitation.hasSubmission) return 'Captura recibida';
	if (invitation.hasRequest) return 'Esperando captura';
	return 'Sin contenido';
}

const InvitationLifecycleActions: FC<{
	invitation: InvitationDTO;
	onArchive: (invitation: InvitationDTO) => void;
	onRestore: (invitation: InvitationDTO) => void;
	onPermanentDelete: (invitation: InvitationDTO) => void;
}> = ({ invitation, onArchive, onRestore, onPermanentDelete }) => {
	if (!invitation.archivedAt) {
		return (
			<button
				type="button"
				className="intake-list__action-danger"
				onClick={() => onArchive(invitation)}
			>
				Archivar
			</button>
		);
	}
	return (
		<>
			<button
				type="button"
				className="intake-list__action-warning"
				onClick={() => onRestore(invitation)}
			>
				Restaurar
			</button>
			<button
				type="button"
				className="intake-list__action-danger"
				onClick={() => onPermanentDelete(invitation)}
			>
				Eliminar definitivamente
			</button>
		</>
	);
};

const InvitationTableRow: FC<InvitationTableRowProps> = ({
	invitation,
	onArchive,
	onRestore,
	onPermanentDelete,
	onDuplicate,
}) => {
	const displayInfo = resolveDisplayInfo(invitation);
	const publishedUrl = publicUrl(invitation);
	const isActive = !invitation.archivedAt;
	const isClient = invitation.kind === 'client';

	return (
		<tr className={!isClient ? 'intake-list__row--demo' : ''}>
			<td className="intake-list__cell-title">{invitation.title}</td>
			<td>{invitation.clientName || '\u2014'}</td>
			<td>{isClient ? 'Invitación' : 'Demo'}</td>
			<td>
				<div className="intake-list__status-cell">
					<StatusBadge variant={displayInfo.variant} label={displayInfo.label} />
					<span className="intake-list__content-summary">
						{contentSummary(invitation)}
					</span>
					{displayInfo.warning && (
						<span className="intake-list__status-warning">{displayInfo.warning}</span>
					)}
				</div>
			</td>
			<td>{new Date(invitation.updatedAt).toLocaleDateString('es-MX')}</td>
			<td className="intake-list__actions">
				{isActive && (
					<a href={invitation.internalEditUrl} className="intake-list__action-primary">
						Editar
					</a>
				)}
				{publishedUrl && isActive && (
					<a
						href={publishedUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="intake-list__action-secondary"
					>
						Ver pública
					</a>
				)}
				{!isClient && isActive && (
					<button
						type="button"
						className="intake-list__action-secondary"
						onClick={() => onDuplicate(invitation)}
					>
						Duplicar
					</button>
				)}
				{isClient && isActive && !invitation.captureUrl && (
					<a
						href={`/dashboard/invitaciones/${invitation.id}`}
						className="intake-list__action-secondary"
					>
						Link cliente
					</a>
				)}
				{isClient && isActive && invitation.captureUrl && (
					<button
						type="button"
						className="intake-list__action-secondary"
						onClick={() => void navigator.clipboard.writeText(invitation.captureUrl!)}
					>
						Copiar link
					</button>
				)}
				<span className="intake-list__action-separator" aria-hidden="true" />
				<InvitationLifecycleActions
					invitation={invitation}
					onArchive={onArchive}
					onRestore={onRestore}
					onPermanentDelete={onPermanentDelete}
				/>
			</td>
		</tr>
	);
};

const InvitationList: FC = () => {
	const {
		items,
		loading,
		error,
		createInvitation,
		archiveInvitation,
		restoreInvitation,
		permanentlyDeleteInvitation,
		duplicateInvitationFromDemo,
	} = useInvitationAdmin();
	const [showForm, setShowForm] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formError, setFormError] = useState('');
	const [actionError, setActionError] = useState('');
	const [activeTab, setActiveTab] = useState<FilterTab>('all');
	const [title, setTitle] = useState('');
	const [clientName, setClientName] = useState('');
	const [clientWhatsapp, setClientWhatsapp] = useState('');
	const [clientEmail, setClientEmail] = useState('');
	const [eventType, setEventType] = useState('');
	const [baseDemoId, setBaseDemoId] = useState('');

	const filteredItems = useMemo(() => {
		const tab = FILTER_TABS.find((item) => item.key === activeTab);
		return tab ? items.filter(tab.match) : items;
	}, [items, activeTab]);

	const handleCreate = async () => {
		if (!title.trim() || !eventType || !baseDemoId) {
			setFormError('Completa el título, el tipo de evento y el demo base.');
			return;
		}
		setCreating(true);
		setFormError('');
		try {
			const invitation = await createInvitation({
				title: title.trim(),
				eventType,
				baseDemoId,
				clientName: clientName.trim() || undefined,
				clientWhatsapp: clientWhatsapp.trim() || undefined,
				clientEmail: clientEmail.trim() || undefined,
			});
			window.location.href = `/dashboard/invitaciones/${invitation.id}/editar`;
		} catch (err) {
			setFormError(toErrorMessage(err, 'Error al crear la invitación.'));
		} finally {
			setCreating(false);
		}
	};

	const runAction = async (action: () => Promise<unknown>, fallback: string) => {
		setActionError('');
		try {
			await action();
		} catch (err) {
			setActionError(toErrorMessage(err, fallback));
		}
	};

	const handleDuplicate = async (invitation: InvitationDTO) => {
		const duplicateTitle = window.prompt(
			'Título de la nueva invitación:',
			`${invitation.title} - copia`,
		);
		if (!duplicateTitle?.trim()) return;
		await runAction(async () => {
			const created = await duplicateInvitationFromDemo(invitation.id, {
				title: duplicateTitle.trim(),
			});
			window.location.href = `/dashboard/invitaciones/${created.id}/editar`;
		}, 'No se pudo duplicar el demo.');
	};

	const handlePermanentDelete = async (invitation: InvitationDTO) => {
		const confirmed = window.confirm(
			`Eliminar definitivamente "${invitation.title}"? Esta acción no se puede deshacer.`,
		);
		if (!confirmed) return;
		await runAction(
			() => permanentlyDeleteInvitation(invitation.id),
			'No se pudo eliminar definitivamente la invitación.',
		);
	};

	return (
		<div className="intake-list">
			<header className="intake-list__header">
				<h2 className="intake-list__title">Producción de invitaciones</h2>
				<p className="intake-list__subtitle">
					Administra invitaciones y demos editables desde un solo lugar.
				</p>
				<button
					type="button"
					className="intake-list__create-btn"
					onClick={() => setShowForm(!showForm)}
				>
					{showForm ? 'Cancelar' : 'Crear invitación'}
				</button>
			</header>

			{showForm && (
				<div className="intake-list__form">
					<h3 className="intake-list__form-title">Crear invitación</h3>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="title">
							Título *
						</label>
						<input
							id="title"
							className="intake-field__input"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</div>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientName">
							Cliente
						</label>
						<input
							id="clientName"
							className="intake-field__input"
							value={clientName}
							onChange={(event) => setClientName(event.target.value)}
						/>
					</div>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientWhatsapp">
							WhatsApp
						</label>
						<input
							id="clientWhatsapp"
							className="intake-field__input"
							value={clientWhatsapp}
							onChange={(event) => setClientWhatsapp(event.target.value)}
						/>
					</div>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientEmail">
							Correo
						</label>
						<input
							id="clientEmail"
							type="email"
							className="intake-field__input"
							value={clientEmail}
							onChange={(event) => setClientEmail(event.target.value)}
						/>
					</div>
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="eventType">
							Tipo de evento *
						</label>
						<select
							id="eventType"
							className="intake-field__select"
							value={eventType}
							onChange={(event) => {
								setEventType(event.target.value);
								setBaseDemoId('');
							}}
						>
							<option value="">Seleccionar...</option>
							{EVENT_TYPES.map((value) => (
								<option key={value} value={value}>
									{EVENT_TYPE_LABELS[value]}
								</option>
							))}
						</select>
					</div>
					<DemoSelector
						eventType={eventType}
						selectedDemoId={baseDemoId}
						onChange={setBaseDemoId}
					/>
					{formError && <p className="intake-list__error">{formError}</p>}
					<button
						type="button"
						className="intake-list__submit-btn"
						onClick={handleCreate}
						disabled={creating}
					>
						{creating ? 'Creando...' : 'Crear invitación'}
					</button>
				</div>
			)}

			{error && <p className="intake-list__error">{error}</p>}
			{actionError && <p className="intake-list__error">{actionError}</p>}

			<nav className="intake-list__tabs">
				{FILTER_TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						className={`intake-list__tab${activeTab === tab.key ? ' intake-list__tab--active' : ''}`}
						onClick={() => setActiveTab(tab.key)}
					>
						{tab.label}
					</button>
				))}
			</nav>

			{loading ? (
				<p className="intake-list__loading">Cargando...</p>
			) : filteredItems.length === 0 ? (
				<EmptyState message="No hay invitaciones en esta vista." />
			) : (
				<div className="intake-list__table-wrap">
					<table className="intake-list__table">
						<thead>
							<tr>
								<th>Invitación</th>
								<th>Cliente</th>
								<th>Tipo</th>
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
									onArchive={(item) =>
										void runAction(
											() => archiveInvitation(item.id),
											'No se pudo archivar la invitación.',
										)
									}
									onRestore={(item) =>
										void runAction(
											() => restoreInvitation(item.id),
											'No se pudo restaurar la invitación.',
										)
									}
									onPermanentDelete={(item) => void handlePermanentDelete(item)}
									onDuplicate={(item) => void handleDuplicate(item)}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

export default InvitationList;
