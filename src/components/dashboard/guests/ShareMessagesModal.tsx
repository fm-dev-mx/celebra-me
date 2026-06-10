import React, { useCallback, useMemo, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_INVITATION_MESSAGE,
	DEFAULT_REMINDER_MESSAGE,
	PREVIEW_CONTEXT,
	SHARE_MESSAGE_VARIABLES,
	SHARE_MESSAGE_VARIABLE_LABELS,
	type ShareMessagesConfig,
	type ReminderSettings,
	type ReminderAudience,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface ShareMessagesModalProps {
	eventId: string;
	eventTitle: string;
	initialTemplates: ShareMessagesConfig;
	initialReminderSettings: ReminderSettings;
	shareDateContext: ShareMessageDateContext;
	onClose: () => void;
	onSave: (result: {
		shareTemplates: ShareMessagesConfig;
		reminderSettings: ReminderSettings;
	}) => void;
}

type ModalTab = 'invitation' | 'reminder' | 'settings';

interface ReminderSettingsPanelProps {
	enabled: boolean;
	days: number;
	audience: ReminderAudience;
	onEnabledChange: (value: boolean) => void;
	onDaysChange: (value: number) => void;
	onAudienceChange: (value: ReminderAudience) => void;
}

const ReminderSettingsPanel: React.FC<ReminderSettingsPanelProps> = ({
	enabled,
	days,
	audience,
	onEnabledChange,
	onDaysChange,
	onAudienceChange,
}) => (
	<div
		role="tabpanel"
		id="tabpanel-share-msg"
		aria-labelledby="tab-settings"
		className="share-messages-modal__settings"
	>
		<p className="share-messages-modal__settings-description">
			Define cuándo quieres mostrar la opción de enviar recordatorios y a qué invitados
			aplicará.
		</p>

		<div className="dashboard-form-field">
			<label className="share-messages-modal__settings-toggle">
				<input
					type="checkbox"
					checked={enabled}
					onChange={(e) => onEnabledChange(e.target.checked)}
				/>
				Mostrar botón de recordatorios
			</label>
		</div>

		{enabled && (
			<>
				<div className="dashboard-form-field">
					<label htmlFor="reminder-days">Mostrar cuando falten:</label>
					<input
						id="reminder-days"
						type="number"
						min={0}
						max={365}
						value={days}
						onChange={(e) => {
							const val = parseInt(e.target.value, 10);
							if (!isNaN(val) && val >= 0 && val <= 365) {
								onDaysChange(val);
							}
						}}
						className="share-messages-modal__days-input"
					/>
					<span>días o menos para el evento</span>
				</div>

				<div className="dashboard-form-field dashboard-form-field--full">
					<span className="dashboard-form-field__label">Enviar recordatorio a:</span>
					<div
						className="share-messages-modal__radio-group"
						role="radiogroup"
						aria-label="Audiencia de recordatorios"
					>
						<label className="share-messages-modal__radio-label">
							<input
								type="radio"
								name="reminderAudience"
								value="unconfirmed"
								checked={audience === 'unconfirmed'}
								onChange={() => onAudienceChange('unconfirmed')}
							/>
							Solo invitados sin confirmar
						</label>
						<label className="share-messages-modal__radio-label">
							<input
								type="radio"
								name="reminderAudience"
								value="all-shared"
								checked={audience === 'all-shared'}
								onChange={() => onAudienceChange('all-shared')}
							/>
							Todos los invitados activos con invitación enviada
						</label>
					</div>
					<p className="share-messages-modal__settings-help">
						{audience === 'unconfirmed'
							? 'Recomendado: solo invitados sin confirmar para evitar enviar mensajes innecesarios.'
							: 'No incluye invitados que rechazaron la invitación.'}
					</p>
				</div>
			</>
		)}
	</div>
);

const ShareMessagesModal: React.FC<ShareMessagesModalProps> = ({
	eventId,
	eventTitle,
	initialTemplates,
	initialReminderSettings,
	shareDateContext,
	onClose,
	onSave,
}) => {
	const [invitation, setInvitation] = useState(initialTemplates.invitation);
	const [reminder, setReminder] = useState(initialTemplates.reminder);
	const [reminderEnabled, setReminderEnabled] = useState(initialReminderSettings.enabled);
	const [reminderDays, setReminderDays] = useState(
		initialReminderSettings.showWhenDaysBeforeEvent,
	);
	const [reminderAudience, setReminderAudience] = useState<ReminderAudience>(
		initialReminderSettings.audience,
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<ModalTab>('invitation');
	const resetConfirm = useConfirmAction(() => {
		setInvitation(DEFAULT_INVITATION_MESSAGE);
		setReminder(DEFAULT_REMINDER_MESSAGE);
	});

	const previewContext = useMemo(
		() => ({
			...PREVIEW_CONTEXT,
			eventTitle: eventTitle || '',
			...shareDateContext,
		}),
		[eventTitle, shareDateContext],
	);

	const previewText = useMemo(
		() =>
			activeTab === 'settings'
				? ''
				: renderShareMessage(
						activeTab === 'invitation' ? invitation : reminder,
						previewContext,
					),
		[activeTab, invitation, reminder, previewContext],
	);

	const isDirty = useMemo(
		() =>
			invitation !== initialTemplates.invitation ||
			reminder !== initialTemplates.reminder ||
			reminderEnabled !== initialReminderSettings.enabled ||
			reminderDays !== initialReminderSettings.showWhenDaysBeforeEvent ||
			reminderAudience !== initialReminderSettings.audience,
		[
			invitation,
			reminder,
			reminderEnabled,
			reminderDays,
			reminderAudience,
			initialTemplates,
			initialReminderSettings,
		],
	);

	const currentReminderSettings = useMemo(
		() => ({
			enabled: reminderEnabled,
			showWhenDaysBeforeEvent: reminderDays,
			audience: reminderAudience,
		}),
		[reminderEnabled, reminderDays, reminderAudience],
	);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setError(null);
		try {
			const result = await guestsApi.updateShareMessages({
				eventId,
				shareMessages: {
					invitation: invitation.trim(),
					reminder: reminder.trim(),
				},
				reminderSettings: currentReminderSettings,
			});
			onSave({
				shareTemplates: result.shareMessages,
				reminderSettings: result.reminderSettings,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar los mensajes.');
		} finally {
			setSaving(false);
		}
	}, [eventId, invitation, reminder, currentReminderSettings, onSave]);

	return (
		<ModalShell
			title="Mensajes para compartir"
			className="dashboard-modal--share-templates"
			onClose={onClose}
		>
			<div className="dashboard-modal__content">
				<p className="dashboard-modal__description">
					Personaliza los mensajes que se usarán al compartir invitaciones por WhatsApp o
					al copiar el mensaje.
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
					<button
						type="button"
						role="tab"
						id="tab-settings"
						aria-selected={activeTab === 'settings'}
						aria-controls="tabpanel-share-msg"
						className={`share-messages-modal__tab ${activeTab === 'settings' ? 'share-messages-modal__tab--active' : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						Recordatorios
					</button>
				</div>

				{activeTab !== 'settings' && (
					<div
						className="dashboard-form-field dashboard-form-field--full"
						role="tabpanel"
						id="tabpanel-share-msg"
						aria-labelledby={
							activeTab === 'invitation' ? 'tab-invitation' : 'tab-reminder'
						}
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
				)}

				{activeTab !== 'settings' && (
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
							Usa estas variables para insertar datos automáticamente.
						</p>
					</div>
				)}

				{activeTab !== 'settings' && (
					<div className="share-messages-modal__preview">
						<span className="share-messages-modal__preview-label">Vista previa:</span>
						<pre className="share-messages-modal__preview-text">{previewText}</pre>
					</div>
				)}

				{activeTab === 'settings' && (
					<ReminderSettingsPanel
						enabled={reminderEnabled}
						days={reminderDays}
						audience={reminderAudience}
						onEnabledChange={setReminderEnabled}
						onDaysChange={setReminderDays}
						onAudienceChange={setReminderAudience}
					/>
				)}

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
