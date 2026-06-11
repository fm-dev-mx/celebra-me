import React, { useCallback, useMemo, useRef, useState } from 'react';
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
			Configura cuándo mostrar recordatorios y a qué invitados enviarlos.
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
				<div className="dashboard-form-field share-messages-modal__days-row">
					<label htmlFor="reminder-days">Mostrar cuando falten</label>
					<div className="share-messages-modal__days-inline">
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
						<span className="share-messages-modal__settings-inline-label">
							días o menos para el evento
						</span>
					</div>
				</div>

				<div className="dashboard-form-field dashboard-form-field--full">
					<span className="share-messages-modal__settings-field-label">
						Enviar recordatorio a:
					</span>
					<div
						className="share-messages-modal__radio-group"
						role="radiogroup"
						aria-label="Audiencia de recordatorios"
					>
						<label
							className={`share-messages-modal__radio-label${audience === 'unconfirmed' ? ' share-messages-modal__radio-label--active' : ''}`}
						>
							<input
								type="radio"
								name="reminderAudience"
								value="unconfirmed"
								checked={audience === 'unconfirmed'}
								onChange={() => onAudienceChange('unconfirmed')}
							/>
							Solo invitados sin confirmar
						</label>
						<label
							className={`share-messages-modal__radio-label${audience === 'all-shared' ? ' share-messages-modal__radio-label--active' : ''}`}
						>
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

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleInsertVariable = useCallback(
		(variable: string) => {
			const textarea = textareaRef.current;
			if (!textarea) return;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const newText =
				textarea.value.substring(0, start) + variable + textarea.value.substring(end);
			if (activeTab === 'invitation') {
				setInvitation(newText);
			} else {
				setReminder(newText);
			}
			requestAnimationFrame(() => {
				textarea.focus();
				textarea.setSelectionRange(start + variable.length, start + variable.length);
			});
		},
		[activeTab],
	);

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
					Personaliza los textos de invitación y recordatorio.
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
						Configuración
					</button>
				</div>

				{activeTab !== 'settings' && (
					<div className="share-messages-modal__editor-card">
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
								ref={textareaRef}
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
								Insertar variable:
							</span>
							{SHARE_MESSAGE_VARIABLES.map((v) => (
								<code
									key={v}
									className="share-messages-modal__variable"
									title={v}
									onClick={() => handleInsertVariable(v)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ')
											handleInsertVariable(v);
									}}
									role="button"
									tabIndex={0}
								>
									{SHARE_MESSAGE_VARIABLE_LABELS[v]}
								</code>
							))}
						</div>

						<div className="share-messages-modal__preview">
							<span className="share-messages-modal__preview-label">
								Vista previa:
							</span>
							<pre className="share-messages-modal__preview-text">{previewText}</pre>
						</div>

						{!resetConfirm.pending ? (
							<button
								type="button"
								className="share-messages-modal__reset-link"
								onClick={resetConfirm.request}
								disabled={saving}
							>
								Restablecer predeterminados
							</button>
						) : (
							<div className="share-messages-modal__reset-confirm">
								<span className="share-messages-modal__reset-confirm-text">
									¿Restablecer mensajes?
								</span>
								<button
									type="button"
									className="share-messages-modal__reset-confirm-yes"
									onClick={resetConfirm.confirm}
									disabled={saving}
								>
									Sí
								</button>
								<button
									type="button"
									className="share-messages-modal__reset-confirm-no"
									onClick={resetConfirm.cancel}
									disabled={saving}
								>
									No
								</button>
							</div>
						)}
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
				<button
					type="button"
					className="btn-secondary btn-secondary--modal dashboard-modal__footer-cancel"
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
