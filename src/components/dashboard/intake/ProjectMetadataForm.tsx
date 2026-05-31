import type { FC } from 'react';
import { useCallback, useState } from 'react';
import type { InvitationProjectStatus } from '@/lib/intake/types';
import { PROJECT_STATUS_LABELS } from '@/lib/intake/labels';
import { adminApi } from '@/lib/dashboard/admin-api';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

interface Props {
	project: {
		id: string;
		title: string;
		clientName: string;
		clientWhatsapp: string;
		clientEmail: string;
		slug: string | null;
		status: InvitationProjectStatus;
		photosReceived: boolean;
	};
}

const ALLOWED_TRANSITIONS: Record<InvitationProjectStatus, InvitationProjectStatus[]> = {
	draft: ['waiting_for_client', 'in_production', 'archived'],
	waiting_for_client: ['draft', 'in_production', 'archived'],
	client_submitted: ['in_review', 'archived'],
	in_review: ['in_production', 'waiting_for_client', 'archived'],
	in_production: ['preview_sent', 'draft', 'archived'],
	preview_sent: ['approved', 'in_production', 'archived'],
	approved: ['published', 'in_production', 'archived'],
	published: ['archived', 'in_production'],
	archived: ['draft'],
};

const ProjectMetadataForm: FC<Props> = ({ project }) => {
	const [title, setTitle] = useState(project.title);
	const [clientName, setClientName] = useState(project.clientName);
	const [clientWhatsapp, setClientWhatsapp] = useState(project.clientWhatsapp);
	const [clientEmail, setClientEmail] = useState(project.clientEmail);
	const [slug, setSlug] = useState(project.slug ?? '');
	const [status, setStatus] = useState(project.status);
	const [photosReceived, setPhotosReceived] = useState(project.photosReceived);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [saveSuccess, setSaveSuccess] = useState(false);

	const allowedStatuses = ALLOWED_TRANSITIONS[project.status] ?? [];
	const canChangeStatus = allowedStatuses.length > 0;

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaveError('');
		setSaveSuccess(false);
		try {
			const payload: Record<string, unknown> = {};

			if (title !== project.title) payload.title = title;
			if (clientName !== project.clientName) payload.clientName = clientName;
			if (clientWhatsapp !== project.clientWhatsapp) payload.clientWhatsapp = clientWhatsapp;
			if (clientEmail !== project.clientEmail) payload.clientEmail = clientEmail;
			if ((slug || null) !== project.slug) payload.slug = slug || null;
			if (status !== project.status) payload.status = status;
			if (photosReceived !== project.photosReceived) payload.photosReceived = photosReceived;

			if (Object.keys(payload).length === 0) {
				setSaveSuccess(true);
				return;
			}

			await adminApi.updateInvitationProject(
				project.id,
				payload as Parameters<typeof adminApi.updateInvitationProject>[1],
			);
			setSaveSuccess(true);
		} catch (err) {
			setSaveError(toErrorMessage(err, 'Error al guardar los cambios.'));
		} finally {
			setSaving(false);
		}
	}, [title, clientName, clientWhatsapp, clientEmail, slug, status, photosReceived, project]);

	return (
		<div className="project-metadata-form">
			<h3 className="project-metadata-form__title">Datos del proyecto</h3>

			<div className="project-metadata-form__fields">
				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-title">
						Título del proyecto
					</label>
					<input
						id="meta-title"
						type="text"
						className="intake-field__input"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-clientName">
						Nombre del cliente
					</label>
					<input
						id="meta-clientName"
						type="text"
						className="intake-field__input"
						value={clientName}
						onChange={(e) => setClientName(e.target.value)}
					/>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-clientWhatsapp">
						WhatsApp del cliente
					</label>
					<input
						id="meta-clientWhatsapp"
						type="text"
						className="intake-field__input"
						value={clientWhatsapp}
						onChange={(e) => setClientWhatsapp(e.target.value)}
					/>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-clientEmail">
						Correo del cliente
					</label>
					<input
						id="meta-clientEmail"
						type="email"
						className="intake-field__input"
						value={clientEmail}
						onChange={(e) => setClientEmail(e.target.value)}
					/>
				</div>

				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-slug">
						Slug (URL amigable)
					</label>
					<input
						id="meta-slug"
						type="text"
						className="intake-field__input"
						value={slug}
						onChange={(e) => setSlug(e.target.value)}
						placeholder="mi-invitacion"
					/>
				</div>

				{canChangeStatus && (
					<div className="intake-field">
						<label className="intake-field__label" htmlFor="meta-status">
							Estado
						</label>
						<select
							id="meta-status"
							className="intake-field__select"
							value={status}
							onChange={(e) => setStatus(e.target.value as InvitationProjectStatus)}
						>
							<option value={project.status}>
								{PROJECT_STATUS_LABELS[project.status]}
							</option>
							{allowedStatuses.map((s) => (
								<option key={s} value={s}>
									{PROJECT_STATUS_LABELS[s]}
								</option>
							))}
						</select>
					</div>
				)}

				<div className="intake-field intake-field--checkbox">
					<label className="intake-field__checkbox-label">
						<input
							type="checkbox"
							checked={photosReceived}
							onChange={(e) => setPhotosReceived(e.target.checked)}
						/>
						<span>Fotos recibidas por WhatsApp</span>
					</label>
				</div>
			</div>

			{saveError && <p className="intake-list__error">{saveError}</p>}
			{saveSuccess && (
				<p className="intake-list__success">Cambios guardados correctamente.</p>
			)}

			<button
				type="button"
				className="intake-list__submit-btn"
				onClick={handleSave}
				disabled={saving}
			>
				{saving ? 'Guardando...' : 'Guardar cambios'}
			</button>
		</div>
	);
};

export default ProjectMetadataForm;
