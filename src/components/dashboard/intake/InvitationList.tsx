import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DemoSelector from '@/components/dashboard/intake/DemoSelector';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import type { InvitationProjectStatus } from '@/lib/intake/types';
import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';
import {
	resolveDisplayInfo,
	resolvePrimaryAction,
	hasInconsistency,
} from '@/lib/intake/display-status';
import { EVENT_TYPE_LABELS, RSVP_STATUS_LABELS } from '@/lib/intake/labels';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

type FilterTab = 'all' | InvitationProjectStatus | 'needs_attention';

const FILTER_TABS: Array<{
	key: FilterTab;
	label: string;
	match: (project: InvitationProjectDTO) => boolean;
}> = [
	{ key: 'all', label: 'Todas', match: () => true },
	{ key: 'draft', label: 'Borrador', match: (p) => p.status === 'draft' },
	{
		key: 'waiting_for_client',
		label: 'Esperando cliente',
		match: (p) => p.status === 'waiting_for_client',
	},
	{
		key: 'in_review',
		label: 'En revisión',
		match: (p) => p.status === 'client_submitted' || p.status === 'in_review',
	},
	{
		key: 'in_production',
		label: 'En producción',
		match: (p) =>
			p.status === 'in_production' || p.status === 'preview_sent' || p.status === 'approved',
	},
	{ key: 'published', label: 'Publicadas', match: (p) => p.status === 'published' },
	{ key: 'archived', label: 'Archivadas', match: (p) => p.status === 'archived' },
	{
		key: 'needs_attention',
		label: 'Requieren atención',
		match: (p) => hasInconsistency(p),
	},
];

const InvitationList: FC = () => {
	const { items, loading, error, createProject } = useInvitationAdmin();
	const [showForm, setShowForm] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formError, setFormError] = useState('');
	const [activeTab, setActiveTab] = useState<FilterTab>('all');

	const [title, setTitle] = useState('');
	const [clientName, setClientName] = useState('');
	const [clientWhatsapp, setClientWhatsapp] = useState('');
	const [clientEmail, setClientEmail] = useState('');
	const [eventType, setEventType] = useState('');
	const [baseDemoId, setBaseDemoId] = useState('');

	const filteredItems = useMemo(() => {
		if (activeTab === 'all') return items;
		const tab = FILTER_TABS.find((t) => t.key === activeTab);
		if (!tab) return items;
		return items.filter(tab.match);
	}, [items, activeTab]);

	const activeTabLabel = FILTER_TABS.find((t) => t.key === activeTab)?.label ?? 'Todas';

	const handleCreate = async () => {
		if (!title.trim()) {
			setFormError('El título es obligatorio.');
			return;
		}
		if (!eventType) {
			setFormError('Selecciona un tipo de evento.');
			return;
		}
		if (!baseDemoId) {
			setFormError('Selecciona un demo base.');
			return;
		}

		setCreating(true);
		setFormError('');

		try {
			const project = await createProject({
				title: title.trim(),
				eventType,
				baseDemoId,
				clientName: clientName.trim() || undefined,
				clientWhatsapp: clientWhatsapp.trim() || undefined,
				clientEmail: clientEmail.trim() || undefined,
			});

			setShowForm(false);
			setTitle('');
			setClientName('');
			setClientWhatsapp('');
			setClientEmail('');
			setEventType('');
			setBaseDemoId('');

			if (project) {
				window.location.href = `/dashboard/invitaciones/${project.id}`;
			}
		} catch (err) {
			setFormError(toErrorMessage(err, 'Error al crear el proyecto.'));
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="intake-list">
			<header className="intake-list__header">
				<h2 className="intake-list__title">Producción de invitaciones</h2>
				<p className="intake-list__subtitle">
					Crea proyectos de invitación desde esta sección. Cada proyecto comienza con un
					demo base que define la estructura visual. Puedes editar los datos internamente
					en cualquier momento y, al publicar, se genera la invitación pública y su evento
					RSVP.
				</p>
				<button
					type="button"
					className="intake-list__create-btn"
					onClick={() => setShowForm(!showForm)}
				>
					{showForm ? 'Cancelar' : 'Crear proyecto de invitación'}
				</button>
			</header>

			{showForm && (
				<div className="intake-list__form">
					<h3 className="intake-list__form-title">Crear nuevo proyecto</h3>

					<div className="intake-field">
						<label className="intake-field__label" htmlFor="title">
							Título del proyecto *
						</label>
						<input
							id="title"
							type="text"
							className="intake-field__input"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Boda Ana y Carlos"
						/>
					</div>

					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientName">
							Nombre del cliente
						</label>
						<input
							id="clientName"
							type="text"
							className="intake-field__input"
							value={clientName}
							onChange={(e) => setClientName(e.target.value)}
						/>
					</div>

					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientWhatsapp">
							WhatsApp del cliente
						</label>
						<input
							id="clientWhatsapp"
							type="text"
							className="intake-field__input"
							value={clientWhatsapp}
							onChange={(e) => setClientWhatsapp(e.target.value)}
							placeholder="+52 1234567890"
						/>
					</div>

					<div className="intake-field">
						<label className="intake-field__label" htmlFor="clientEmail">
							Correo del cliente (opcional)
						</label>
						<input
							id="clientEmail"
							type="email"
							className="intake-field__input"
							value={clientEmail}
							onChange={(e) => setClientEmail(e.target.value)}
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
							onChange={(e) => {
								setEventType(e.target.value);
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
						{creating ? 'Creando...' : 'Crear proyecto'}
					</button>
				</div>
			)}

			{error && <p className="intake-list__error">{error}</p>}

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
				<EmptyState
					message={
						activeTab === 'all'
							? 'No hay invitaciones creadas aún.'
							: `No hay proyectos en "${activeTabLabel}".`
					}
				/>
			) : (
				<div className="intake-list__table-wrap">
					<table className="intake-list__table">
						<thead>
							<tr>
								<th>Proyecto</th>
								<th>Cliente</th>
								<th>Tipo</th>
								<th>Estado</th>
								<th>Enlace</th>
								<th>RSVP</th>
								<th>Creado</th>
								<th>Acción</th>
							</tr>
						</thead>
						<tbody>
							{filteredItems.map((project) => {
								const displayInfo = resolveDisplayInfo(project);
								const primaryAction = resolvePrimaryAction(project);
								const rsvpLabel = project.rsvpEventStatus
									? (RSVP_STATUS_LABELS[project.rsvpEventStatus] ??
										project.rsvpEventStatus)
									: 'Sin evento RSVP';
								const isPublicLink = primaryAction?.href?.startsWith(
									`/${project.eventType}/`,
								);
								return (
									<tr key={project.id}>
										<td className="intake-list__cell-title">{project.title}</td>
										<td>{project.clientName || '\u2014'}</td>
										<td>
											{EVENT_TYPE_LABELS[project.eventType] ??
												project.eventType}
										</td>
										<td>
											<div className="intake-list__status-cell">
												<StatusBadge
													variant={displayInfo.variant}
													label={displayInfo.label}
												/>
												{displayInfo.warning && (
													<span className="intake-list__status-warning">
														{displayInfo.warning}
													</span>
												)}
											</div>
										</td>
										<td className="intake-list__cell-link">
											<a
												href={project.internalEditUrl}
												className="intake-list__action-primary"
											>
												Editar datos base
											</a>
										</td>
										<td>{rsvpLabel}</td>
										<td>
											{new Date(project.createdAt).toLocaleDateString(
												'es-MX',
											)}
										</td>
										<td className="intake-list__actions">
											{primaryAction?.href ? (
												<a
													href={primaryAction.href}
													className="intake-list__action-primary"
													target={isPublicLink ? '_blank' : undefined}
													rel={
														isPublicLink
															? 'noopener noreferrer'
															: undefined
													}
												>
													{primaryAction.text}
												</a>
											) : (
												<span className="intake-list__action-primary intake-list__action-primary--muted">
													{primaryAction?.text}
												</span>
											)}
											<a
												href={`/dashboard/invitaciones/${project.id}`}
												className="intake-list__action-secondary"
											>
												Administrar proyecto
											</a>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

export default InvitationList;
