import type { FC } from 'react';
import { useCallback, useState } from 'react';
import type { InvitationStatus } from '@/lib/intake/types';
import { INVITATION_STATUS_LABELS } from '@/lib/intake/labels';
import { adminApi } from '@/lib/dashboard/admin-api';
import { toErrorMessage } from '@/lib/rsvp/core/errors';

interface Props {
	invitation: {
		id: string;
		title: string;
		clientName: string;
		clientWhatsapp: string;
		clientEmail: string;
		slug: string | null;
		status: InvitationStatus;
		photosReceived: boolean;
	};
}

const ALLOWED_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
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

const InvitationMetadataForm: FC<Props> = ({ invitation }) => {
	const [title, setTitle] = useState(invitation.title);
	const [clientName, setClientName] = useState(invitation.clientName);
	const [clientWhatsapp, setClientWhatsapp] = useState(invitation.clientWhatsapp);
	const [clientEmail, setClientEmail] = useState(invitation.clientEmail);
	const [slug, setSlug] = useState(invitation.slug ?? '');
	const [status, setStatus] = useState(invitation.status);
	const [photosReceived, setPhotosReceived] = useState(invitation.photosReceived);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [saveSuccess, setSaveSuccess] = useState(false);

	const allowedStatuses = ALLOWED_TRANSITIONS[invitation.status] ?? [];
	const canChangeStatus = allowedStatuses.length > 0;

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaveError('');
		setSaveSuccess(false);
		try {
			const payload: Record<string, unknown> = {};

			if (title !== invitation.title) payload.title = title;
			if (clientName !== invitation.clientName) payload.clientName = clientName;
			if (clientWhatsapp !== invitation.clientWhatsapp)
				payload.clientWhatsapp = clientWhatsapp;
			if (clientEmail !== invitation.clientEmail) payload.clientEmail = clientEmail;
			if ((slug || null) !== invitation.slug) payload.slug = slug || null;
			if (status !== invitation.status) payload.status = status;
			if (photosReceived !== invitation.photosReceived)
				payload.photosReceived = photosReceived;

			if (Object.keys(payload).length === 0) {
				setSaveSuccess(true);
				return;
			}

			await adminApi.updateInvitation(
				invitation.id,
				payload as Parameters<typeof adminApi.updateInvitation>[1],
			);
			setSaveSuccess(true);
		} catch (err) {
			setSaveError(toErrorMessage(err, 'Error al guardar los cambios.'));
		} finally {
			setSaving(false);
		}
	}, [title, clientName, clientWhatsapp, clientEmail, slug, status, photosReceived, invitation]);

	return (
		<div className="invitation-metadata-form">
			<h3 className="invitation-metadata-form__title">Datos de la invitación</h3>

			<div className="invitation-metadata-form__fields">
				<div className="intake-field">
					<label className="intake-field__label" htmlFor="meta-title">
						Título de la invitación
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
							onChange={(e) => setStatus(e.target.value as InvitationStatus)}
						>
							<option value={invitation.status}>
								{INVITATION_STATUS_LABELS[invitation.status]}
							</option>
							{allowedStatuses.map((s) => (
								<option key={s} value={s}>
									{INVITATION_STATUS_LABELS[s]}
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

export default InvitationMetadataForm;
