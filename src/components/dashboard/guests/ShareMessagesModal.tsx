import React, { useCallback, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	PREVIEW_CONTEXT,
	SHARE_MESSAGE_VARIABLES,
	SHARE_MESSAGE_VARIABLE_LABELS,
	type ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface ShareMessagesModalProps {
	eventId: string;
	eventTitle: string;
	initialTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	onClose: () => void;
	onSave: (templates: ShareMessagesConfig) => void;
}

const ShareMessagesModal: React.FC<ShareMessagesModalProps> = ({
	eventId,
	eventTitle,
	initialTemplates,
	shareDateContext,
	onClose,
	onSave,
}) => {
	const [invitation, setInvitation] = useState(initialTemplates.invitation);
	const [reminder, setReminder] = useState(initialTemplates.reminder);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'invitation' | 'reminder'>('invitation');
	const resetConfirm = useConfirmAction(() => {
		setInvitation(DEFAULT_INVITATION_MESSAGE);
		setReminder(DEFAULT_REMINDER_MESSAGE);
	});

	const previewContext = {
		...PREVIEW_CONTEXT,
		eventTitle: eventTitle || '',
		...shareDateContext,
	};

	const previewText = renderShareMessage(
		activeTab === 'invitation' ? invitation : reminder,
		previewContext,
	);

	const isDirty =
		invitation !== initialTemplates.invitation || reminder !== initialTemplates.reminder;

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
		<ModalShell
			title="Mensajes para compartir"
			className="dashboard-modal--share-templates"
			onClose={onClose}
		>
			<div className="dashboard-modal__content">
				<p className="dashboard-modal__description">
					Personaliza los mensajes que se usar&aacute;n al compartir invitaciones por
					WhatsApp o al copiar el mensaje.
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
					{SHARE_MESSAGE_VARIABLES.map((v) => (
						<code
							key={v}
							className="share-messages-modal__variable"
							title={SHARE_MESSAGE_VARIABLE_LABELS[v]}
						>
							{v}
						</code>
					))}
					<p className="share-messages-modal__variables-help">
						Usa estas variables para insertar datos autom&aacute;ticamente.
					</p>
				</div>

				<div className="share-messages-modal__preview">
					<span className="share-messages-modal__preview-label">Vista previa:</span>
					<pre className="share-messages-modal__preview-text">{previewText}</pre>
				</div>

				{error && <p className="dashboard-error">{error}</p>}
			</div>

			<div className="dashboard-modal__footer">
				{resetConfirm.pending ? (
					<>
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={resetConfirm.cancel}
							disabled={saving}
						>
							Cancelar
						</button>
						<button
							type="button"
							className="btn-primary btn-primary--danger"
							onClick={resetConfirm.confirm}
							disabled={saving}
						>
							¿Restablecer?
						</button>
					</>
				) : (
					<>
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={resetConfirm.request}
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
					</>
				)}
			</div>
		</ModalShell>
	);
};

export default ShareMessagesModal;
