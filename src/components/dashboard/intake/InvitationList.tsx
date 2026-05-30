import type { FC } from 'react';
import { useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import DemoSelector from '@/components/dashboard/intake/DemoSelector';
import { PROJECT_STATUS_LABELS } from '@/lib/intake/labels';

const EVENT_TYPES = [
	{ value: 'xv', label: 'XV anos' },
	{ value: 'boda', label: 'Boda' },
	{ value: 'bautizo', label: 'Bautizo' },
	{ value: 'cumple', label: 'Cumpleanos' },
];

const InvitationList: FC = () => {
	const { items, loading, error, createProject } = useInvitationAdmin();
	const [showForm, setShowForm] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formError, setFormError] = useState('');

	const [title, setTitle] = useState('');
	const [clientName, setClientName] = useState('');
	const [clientWhatsapp, setClientWhatsapp] = useState('');
	const [clientEmail, setClientEmail] = useState('');
	const [eventType, setEventType] = useState('');
	const [baseDemoId, setBaseDemoId] = useState('');

	const handleCreate = async () => {
		if (!title.trim()) {
			setFormError('El titulo es obligatorio.');
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
			setFormError(err instanceof Error ? err.message : 'Error al crear el proyecto.');
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="intake-list">
			<header className="intake-list__header">
				<h2 className="intake-list__title">Producción de invitaciones</h2>
				<button
					type="button"
					className="intake-list__create-btn"
					onClick={() => setShowForm(!showForm)}
				>
					{showForm ? 'Cancelar' : 'Nueva invitacion'}
				</button>
			</header>

			{showForm && (
				<div className="intake-list__form">
					<h3 className="intake-list__form-title">Crear nueva invitacion</h3>

					<div className="intake-field">
						<label className="intake-field__label" htmlFor="title">
							Titulo del proyecto *
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
							{EVENT_TYPES.map((et) => (
								<option key={et.value} value={et.value}>
									{et.label}
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

			{loading ? (
				<p className="intake-list__loading">Cargando...</p>
			) : items.length === 0 ? (
				<p className="intake-list__empty">No hay invitaciones creadas aun.</p>
			) : (
				<div className="intake-list__table-wrap">
					<table className="intake-list__table">
						<thead>
							<tr>
								<th>Titulo</th>
								<th>Cliente</th>
								<th>Tipo</th>
								<th>Estado</th>
								<th>Creado</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{items.map((project) => (
								<tr key={project.id}>
									<td className="intake-list__cell-title">{project.title}</td>
									<td>{project.clientName || '—'}</td>
									<td>{project.eventType}</td>
									<td>
										<span className="intake-list__status">
											{PROJECT_STATUS_LABELS[project.status] ??
												project.status}
										</span>
									</td>
									<td>
										{new Date(project.createdAt).toLocaleDateString('es-MX')}
									</td>
									<td>
										<a
											href={`/dashboard/invitaciones/${project.id}`}
											className="intake-list__link"
										>
											Ver
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

export default InvitationList;
