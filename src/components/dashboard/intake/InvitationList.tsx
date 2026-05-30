import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DemoSelector from '@/components/dashboard/intake/DemoSelector';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EmptyState from '@/components/dashboard/EmptyState';
import { PROJECT_STATUS_LABELS } from '@/lib/intake/labels';
import { EVENT_TYPES } from '@/lib/theme/theme-contract';
import type { InvitationProjectStatus } from '@/lib/intake/types';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

const STATUS_VARIANT: Record<
	string,
	| 'draft'
	| 'published'
	| 'archived'
	| 'waiting'
	| 'submitted'
	| 'review'
	| 'production'
	| 'preview'
	| 'approved'
> = {
	draft: 'draft',
	waiting_for_client: 'waiting',
	client_submitted: 'submitted',
	in_review: 'review',
	in_production: 'production',
	preview_sent: 'preview',
	approved: 'approved',
	published: 'published',
	archived: 'archived',
};

type FilterTab = 'all' | InvitationProjectStatus;

const FILTER_TABS: Array<{ key: FilterTab; label: string; statuses: InvitationProjectStatus[] }> = [
	{ key: 'all', label: 'Todas', statuses: [] },
	{ key: 'draft', label: 'Borrador', statuses: ['draft'] },
	{ key: 'waiting_for_client', label: 'Esperando cliente', statuses: ['waiting_for_client'] },
	{ key: 'in_review', label: 'En revisión', statuses: ['client_submitted', 'in_review'] },
	{
		key: 'in_production',
		label: 'En producción',
		statuses: ['in_production', 'preview_sent', 'approved'],
	},
	{ key: 'published', label: 'Publicadas', statuses: ['published'] },
	{ key: 'archived', label: 'Archivadas', statuses: ['archived'] },
];

function getNextStep(project: {
	status: InvitationProjectStatus;
	id: string;
	slug: string | null;
	eventType: string;
}): { text: string; href?: string } | null {
	switch (project.status) {
		case 'draft':
			return {
				text: 'Generar link de captura',
				href: `/dashboard/invitaciones/${project.id}`,
			};
		case 'waiting_for_client':
			return { text: 'Esperando respuesta del cliente' };
		case 'client_submitted':
			return {
				text: 'Revisar captura',
				href: `/dashboard/invitaciones/${project.id}/review`,
			};
		case 'in_review':
			return { text: 'En revisión' };
		case 'in_production':
			return { text: 'Continuar producción', href: `/dashboard/invitaciones/${project.id}` };
		case 'preview_sent':
			return { text: 'Esperando aprobación final' };
		case 'approved':
			return {
				text: 'Generar borrador',
				href: `/dashboard/invitaciones/${project.id}/draft`,
			};
		case 'published': {
			const publicSlug = project.slug ?? `${project.eventType}-${project.id.slice(0, 8)}`;
			return { text: 'Ver invitación pública', href: `/${project.eventType}/${publicSlug}` };
		}
		case 'archived':
			return { text: 'Archivada' };
	}
}

const EVENT_TYPE_LABELS: Record<string, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
};

const RSVP_LABELS: Record<string, string> = {
	published: 'RSVP activo',
	archived: 'RSVP desactivado',
	draft: 'RSVP borrador',
};

const CAPTURE_LABELS: Record<string, string> = {
	pending: 'Captura pendiente',
	sent: 'Captura enviada',
};

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
		return items.filter((p) => tab.statuses.includes(p.status));
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
					demo base que define la estructura visual, el cliente envía su contenido
					mediante el enlace de captura, y al publicar se genera la invitación pública y
					su evento RSVP.
				</p>
				<button
					type="button"
					className="intake-list__create-btn"
					onClick={() => setShowForm(!showForm)}
				>
					{showForm ? 'Cancelar' : 'Nueva invitación'}
				</button>
			</header>

			{showForm && (
				<div className="intake-list__form">
					<h3 className="intake-list__form-title">Crear nueva invitación</h3>

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
								<th>Invitación</th>
								<th>Cliente</th>
								<th>Tipo</th>
								<th>Estado</th>
								<th>Captura</th>
								<th>Publicación</th>
								<th>RSVP</th>
								<th>Creado</th>
								<th>Siguiente paso</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{filteredItems.map((project) => {
								const nextStep = getNextStep(project);
								const captureLabel = project.hasRequest
									? CAPTURE_LABELS.sent
									: CAPTURE_LABELS.pending;
								const pubLabel = project.published ? 'Publicada' : 'Sin publicar';
								const rsvpLabel = project.rsvpEventStatus
									? (RSVP_LABELS[project.rsvpEventStatus] ??
										project.rsvpEventStatus)
									: '\u2014';
								const publicUrl = project.slug
									? `/${project.eventType}/${project.slug}`
									: null;
								return (
									<tr key={project.id}>
										<td className="intake-list__cell-title">{project.title}</td>
										<td>{project.clientName || '\u2014'}</td>
										<td>
											{EVENT_TYPE_LABELS[project.eventType] ??
												project.eventType}
										</td>
										<td>
											<StatusBadge
												variant={
													STATUS_VARIANT[project.status] ?? 'generic'
												}
												label={
													PROJECT_STATUS_LABELS[project.status] ??
													project.status
												}
											/>
										</td>
										<td>{captureLabel}</td>
										<td>{pubLabel}</td>
										<td>{rsvpLabel}</td>
										<td>
											{new Date(project.createdAt).toLocaleDateString(
												'es-MX',
											)}
										</td>
										<td>
											{nextStep?.href ? (
												<a
													href={nextStep.href}
													className="intake-list__next-step"
												>
													{nextStep.text}
												</a>
											) : (
												<span className="intake-list__next-step intake-list__next-step--muted">
													{nextStep?.text}
												</span>
											)}
										</td>
										<td className="intake-list__actions">
											<a
												href={`/dashboard/invitaciones/${project.id}`}
												className="intake-list__link"
											>
												Ver detalle
											</a>
											{publicUrl && (
												<a
													href={publicUrl}
													className="intake-list__link"
													target="_blank"
													rel="noopener noreferrer"
												>
													Ver pública
												</a>
											)}
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
