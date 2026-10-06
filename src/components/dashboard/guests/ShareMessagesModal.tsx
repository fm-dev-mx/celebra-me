import React, { useCallback, useMemo, useRef, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	DEFAULT_PREVIEW_CONTEXT,
	SHARE_MESSAGE_VARIABLES,
	SHARE_MESSAGE_VARIABLE_LABELS,
	SHARE_MESSAGE_VARIABLE_TOOLTIPS,
	INVITATION_TAB_VARIABLES,
	REMINDER_TAB_VARIABLES,
	getDefaultInvitationTemplate,
	getDefaultReminderTemplate,
	getSuggestedPresets,
	smartInsertVariable,
	type ShareMessagesConfig,
	type ReminderSettings,
	type ReminderAudience,
	type ShareMessageVariable,
	type MessagePreset,
} from '@/lib/rsvp/services/shared/share-message-defaults';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { guestsApi } from '@/lib/dashboard/guests-api';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface ShareMessagesModalProps {
	eventId: string;
	eventTitle: string;
	eventType?: EventRecord['eventType'];
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
		id="tabpanel-share-settings"
		aria-labelledby="tab-settings"
		className="share-messages-modal__settings"
	>
		<p className="share-messages-modal__settings-description">
			Configure cuándo mostrar recordatorios y a qué invitados enviarlos.
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

interface ShareMessagesPresetsProps {
	presets: MessagePreset[];
	onApplyPreset: (preset: MessagePreset) => void;
}

const ShareMessagesPresets: React.FC<ShareMessagesPresetsProps> = ({ presets, onApplyPreset }) => (
	<div className="share-messages-modal__presets">
		<span className="share-messages-modal__presets-label">Estilos sugeridos:</span>
		<div
			className="share-messages-modal__preset-chips"
			role="group"
			aria-label="Estilos sugeridos"
		>
			{presets.map((preset) => (
				<button
					type="button"
					key={preset.id}
					className="share-messages-modal__preset-btn"
					title={preset.description}
					onClick={() => onApplyPreset(preset)}
				>
					<span className="share-messages-modal__preset-icon" aria-hidden="true">
						{preset.id === 'recommended' ? '🌟' : preset.id === 'warm' ? '💬' : '⚡'}
					</span>
					<span>{preset.label}</span>
				</button>
			))}
		</div>
	</div>
);

interface ShareMessagesVariablesProps {
	primaryVariables: ShareMessageVariable[];
	duplicateNotice: string | null;
	onInsertVariable: (variable: ShareMessageVariable) => void;
}

const ShareMessagesVariables: React.FC<ShareMessagesVariablesProps> = ({
	primaryVariables,
	duplicateNotice,
	onInsertVariable,
}) => (
	<div className="share-messages-modal__variables">
		<div className="share-messages-modal__variables-header">
			<span className="share-messages-modal__variables-label">Insertar variable:</span>
			<span className="share-messages-modal__variables-help">
				Toque una variable para insertarla con espaciado automático donde esté su cursor.
			</span>
		</div>
		<div className="share-messages-modal__variables-grid">
			{SHARE_MESSAGE_VARIABLES.map((v) => {
				const isPrimary = primaryVariables.includes(v);
				return (
					<button
						key={v}
						type="button"
						className={`share-messages-modal__variable ${isPrimary ? 'share-messages-modal__variable--primary' : 'share-messages-modal__variable--secondary'}`}
						title={SHARE_MESSAGE_VARIABLE_TOOLTIPS[v] ?? v}
						onClick={() => onInsertVariable(v)}
					>
						<span className="share-messages-modal__variable-plus" aria-hidden="true">
							+
						</span>
						<span>{SHARE_MESSAGE_VARIABLE_LABELS[v]}</span>
					</button>
				);
			})}
		</div>
		{duplicateNotice && (
			<p className="share-messages-modal__variables-notice" role="status">
				ℹ️ {duplicateNotice}
			</p>
		)}
	</div>
);

interface ShareMessagesPreviewProps {
	previewText: string;
}

const ShareMessagesPreview: React.FC<ShareMessagesPreviewProps> = ({ previewText }) => (
	<div className="share-messages-modal__preview">
		<div className="share-messages-modal__preview-header">
			<span className="share-messages-modal__preview-label">Vista previa:</span>
			<span className="share-messages-modal__preview-badge">Así se verá en WhatsApp</span>
		</div>
		<div className="share-messages-modal__preview-bubble">
			<pre className="share-messages-modal__preview-text">{previewText}</pre>
			<div className="share-messages-modal__preview-meta" aria-hidden="true">
				<span className="share-messages-modal__preview-time">12:00 p. m.</span>
				<span className="share-messages-modal__preview-check">✓✓</span>
			</div>
		</div>
	</div>
);

const ShareMessagesModal: React.FC<ShareMessagesModalProps> = ({
	eventId,
	eventTitle,
	eventType,
	initialTemplates,
	initialReminderSettings,
	shareDateContext,
	onClose,
	onSave,
}) => {
	const defaultInvitation = useMemo(() => getDefaultInvitationTemplate(eventType), [eventType]);
	const defaultReminder = useMemo(
		() => getDefaultReminderTemplate('pending', eventType),
		[eventType],
	);

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
	const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<ModalTab>('invitation');

	const presets = useMemo(() => getSuggestedPresets(eventType), [eventType]);

	const resetConfirm = useConfirmAction(() => {
		setInvitation(defaultInvitation);
		setReminder(defaultReminder);
	});

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleInsertVariable = useCallback(
		(variable: ShareMessageVariable) => {
			const textarea = textareaRef.current;
			if (!textarea) return;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const currentVal = activeTab === 'invitation' ? invitation : reminder;

			const result = smartInsertVariable(currentVal, start, end, variable);

			if (result.wasDuplicate) {
				setDuplicateNotice(
					`"${SHARE_MESSAGE_VARIABLE_LABELS[variable]}" ya se encuentra agregado en esa posición.`,
				);
				setTimeout(() => setDuplicateNotice(null), 3000);
				return;
			}

			setDuplicateNotice(null);
			if (activeTab === 'invitation') {
				setInvitation(result.newText);
			} else {
				setReminder(result.newText);
			}

			requestAnimationFrame(() => {
				textarea.focus();
				textarea.setSelectionRange(result.newCursorPos, result.newCursorPos);
			});
		},
		[activeTab, invitation, reminder],
	);

	const handleApplyPreset = (preset: MessagePreset) => {
		if (activeTab === 'invitation') {
			setInvitation(preset.invitation);
		} else if (activeTab === 'reminder') {
			setReminder(preset.reminder);
		}
	};

	const previewContext = useMemo(
		() => ({
			...DEFAULT_PREVIEW_CONTEXT,
			eventTitle: eventTitle || DEFAULT_PREVIEW_CONTEXT.eventTitle,
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

	const currentText = activeTab === 'invitation' ? invitation : reminder;
	const missingLink = !currentText.includes('{{enlace}}') && !currentText.includes('{inviteUrl}');
	const hasGluedVariables = useMemo(() => /\}\}\{\{/.test(currentText), [currentText]);

	const primaryVariables = useMemo(
		() => (activeTab === 'invitation' ? INVITATION_TAB_VARIABLES : REMINDER_TAB_VARIABLES),
		[activeTab],
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
					Personalice los textos de invitación y recordatorio.
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
						aria-controls="tabpanel-share-settings"
						className={`share-messages-modal__tab ${activeTab === 'settings' ? 'share-messages-modal__tab--active' : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						Configuración
					</button>
				</div>

				{activeTab !== 'settings' && (
					<div className="share-messages-modal__editor-section">
						<ShareMessagesPresets presets={presets} onApplyPreset={handleApplyPreset} />

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
									activeTab === 'invitation' ? defaultInvitation : defaultReminder
								}
							/>
							<span className="share-messages-modal__char-count">
								{(activeTab === 'invitation' ? invitation : reminder).length}/500
							</span>
						</div>

						{missingLink && (
							<p className="share-messages-modal__hint-alert" role="status">
								💡 Se recomienda incluir el dato{' '}
								<strong>Enlace a la invitación</strong> para que sus invitados
								puedan abrirla.
							</p>
						)}

						{hasGluedVariables && (
							<p
								className="share-messages-modal__hint-alert share-messages-modal__hint-alert--warning"
								role="status"
							>
								⚠️ Se detectaron datos automáticos pegados sin espacio. Se
								recomienda separarlos con un espacio o salto de línea.
							</p>
						)}

						<ShareMessagesVariables
							primaryVariables={primaryVariables}
							duplicateNotice={duplicateNotice}
							onInsertVariable={handleInsertVariable}
						/>

						<ShareMessagesPreview previewText={previewText} />

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
