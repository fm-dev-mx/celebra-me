import React, { useCallback, useEffect, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	type ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { guestsApi } from '@/lib/dashboard/guests-api';

interface ShareMessagesModalProps {
	eventId: string;
	eventTitle: string;
	initialTemplates: ShareMessagesConfig;
	onClose: () => void;
	onSave: (templates: ShareMessagesConfig) => void;
}

const AVAILABLE_VARIABLES = ['{guestName}', '{eventTitle}', '{inviteUrl}'];

const PREVIEW_CONTEXT = {
	guestName: 'María García',
	eventTitle: '',
	inviteUrl: 'https://celebra-me.com/xv/ejemplo/i/ABC123',
};

const ShareMessagesModal: React.FC<ShareMessagesModalProps> = ({
	eventId,
	eventTitle,
	initialTemplates,
	onClose,
	onSave,
}) => {
	const [invitation, setInvitation] = useState(initialTemplates.invitation);
	const [reminder, setReminder] = useState(initialTemplates.reminder);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'invitation' | 'reminder'>('invitation');

	useEffect(() => {
		setInvitation(initialTemplates.invitation);
		setReminder(initialTemplates.reminder);
	}, [initialTemplates]);

	const previewContext = {
		...PREVIEW_CONTEXT,
		eventTitle: eventTitle || PREVIEW_CONTEXT.eventTitle,
	};

	const previewText = renderShareMessage(
		activeTab === 'invitation' ? invitation : reminder,
		previewContext,
	);

	const isDirty =
		invitation !== initialTemplates.invitation || reminder !== initialTemplates.reminder;

	const handleReset = useCallback(() => {
		setInvitation(DEFAULT_INVITATION_MESSAGE);
		setReminder(DEFAULT_REMINDER_MESSAGE);
	}, []);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setError(null);
		try {
			const result = await guestsApi.updateShareMessages(eventId, {
				invitation: invitation.trim(),
				reminder: reminder.trim(),
			});
			onSave(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar los mensajes.');
		} finally {
			setSaving(false);
		}
	}, [eventId, invitation, reminder, onSave]);

	return (
		<ModalShell title="Mensajes para compartir" onClose={onClose}>
			<div className="dashboard-modal__content">
				<p className="dashboard-modal__description">
					Edita las plantillas de mensaje que se usan al compartir invitaciones por
					WhatsApp, copiar mensaje o copiar enlace.
				</p>

				<div
					className="share-messages-modal__tabs"
					role="tablist"
					aria-label="Tipo de mensaje"
				>
					<button
						type="button"
						role="tab"
						id="tab-invitation"
						aria-selected={activeTab === 'invitation'}
						aria-controls="tabpanel-share-msg"
						className={`share-messages-modal__tab ${activeTab === 'invitation' ? 'share-messages-modal__tab--active' : ''}`}
						onClick={() => setActiveTab('invitation')}
					>
						Invitación
					</button>
					<button
						type="button"
						role="tab"
						id="tab-reminder"
						aria-selected={activeTab === 'reminder'}
						aria-controls="tabpanel-share-msg"
						className={`share-messages-modal__tab ${activeTab === 'reminder' ? 'share-messages-modal__tab--active' : ''}`}
						onClick={() => setActiveTab('reminder')}
					>
						Recordatorio
					</button>
				</div>

				<div
					className="dashboard-form-field dashboard-form-field--full"
					role="tabpanel"
					id="tabpanel-share-msg"
					aria-labelledby={activeTab === 'invitation' ? 'tab-invitation' : 'tab-reminder'}
				>
					<label htmlFor={`share-msg-${activeTab}`}>
						{activeTab === 'invitation'
							? 'Mensaje de invitación'
							: 'Mensaje de recordatorio'}
					</label>
					<textarea
						id={`share-msg-${activeTab}`}
						className="share-messages-modal__textarea"
						rows={5}
						maxLength={500}
						value={activeTab === 'invitation' ? invitation : reminder}
						onChange={(e) => {
							if (activeTab === 'invitation') {
								setInvitation(e.target.value);
							} else {
								setReminder(e.target.value);
							}
						}}
						placeholder={
							activeTab === 'invitation'
								? DEFAULT_INVITATION_MESSAGE
								: DEFAULT_REMINDER_MESSAGE
						}
					/>
					<span className="share-messages-modal__char-count">
						{(activeTab === 'invitation' ? invitation : reminder).length}/500
					</span>
				</div>

				<div className="share-messages-modal__variables">
					<span className="share-messages-modal__variables-label">
						Variables disponibles:
					</span>
					{AVAILABLE_VARIABLES.map((v) => (
						<code key={v} className="share-messages-modal__variable">
							{v}
						</code>
					))}
				</div>

				<div className="share-messages-modal__preview">
					<span className="share-messages-modal__preview-label">Vista previa:</span>
					<pre className="share-messages-modal__preview-text">{previewText}</pre>
				</div>

				{error && <p className="dashboard-error">{error}</p>}
			</div>

			<div className="dashboard-modal__footer">
				<button
					type="button"
					className="btn-secondary btn-secondary--modal"
					onClick={handleReset}
					disabled={saving}
				>
					Restablecer predeterminados
				</button>
				<button
					type="button"
					className="btn-secondary btn-secondary--modal"
					onClick={onClose}
					disabled={saving}
				>
					Cancelar
				</button>
				<button
					type="button"
					className="btn-primary"
					onClick={handleSave}
					disabled={saving || !isDirty}
				>
					{saving ? 'Guardando...' : 'Guardar'}
				</button>
			</div>
		</ModalShell>
	);
};

export default ShareMessagesModal;
