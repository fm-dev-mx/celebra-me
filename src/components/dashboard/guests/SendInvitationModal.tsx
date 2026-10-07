import React, { useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CopyIcon } from '@/components/common/icons/ui';
import GuestPeopleStepper from '@/components/dashboard/guests/GuestPeopleStepper';
import { MAX_CUSTOM_ATTENDEES } from '@/components/dashboard/guests/guest-form-constants';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
import type {
	GuestSaveCallback,
	ShareFlowMode,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface SendInvitationModalProps {
	guest: DashboardGuestItem | null;
	pendingGuests: DashboardGuestItem[];
	inviteUrl: string;
	onClose: () => void;
	onSave: GuestSaveCallback;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onReminderSent?: (guestId: string) => void;
	onAdvanceFromGuest?: (currentGuestId: string) => void;
	onPostponeGuest?: (currentGuestId: string) => void;
	templates?: ShareMessagesConfig;
	shareDateContext?: ShareMessageDateContext;
	eventTitle?: string;
	mode?: ShareFlowMode;
}

const MODE_TITLES: Record<ShareFlowMode, string> = {
	'pending-invitation': 'Enviar invitación',
	'single-invitation': 'Compartir invitación',
	'pending-reminder': 'Enviar recordatorio',
	'single-reminder': 'Enviar recordatorio',
};

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
	guest,
	pendingGuests,
	inviteUrl,
	onClose,
	onSave,
	onMarkShared,
	onReminderSent,
	onAdvanceFromGuest,
	onPostponeGuest,
	templates,
	shareDateContext,
	eventTitle,
	mode = 'pending-invitation',
}) => {
	const {
		editName,
		setEditName,
		setEditMaxAttendees,
		editPhone,
		setEditPhone,
		editCountryCode,
		setEditCountryCode,
		phoneError,
		shareStatus,
		fallbackGuest,
		markError,
		advancing,
		pendingCount,
		canSendToPhone,
		editingMessage,
		activeMessage,
		localMessageOverride,
		messageError,
		isQueueMode,
		isReminderMode,
		copySuccess,
		handleEditMessage,
		handleCancelEditMessage,
		handleResetMessage,
		handleUpdateLocalMessage,
		handleCopyMessageAction,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	} = useSendInvitation({
		guest,
		pendingGuests,
		inviteUrl,
		onSave,
		onMarkShared,
		onReminderSent,
		onAdvanceFromGuest,
		onPostponeGuest,
		onDone: onClose,
		templates,
		shareDateContext,
		eventTitle,
		mode,
	});

	// Raw text so the host can clear the field while typing a larger number.
	const [peopleInput, setPeopleInput] = useState(() =>
		guest ? String(guest.maxAllowedAttendees) : '1',
	);
	const [customAttendeesError, setCustomAttendeesError] = useState<string | null>(null);

	React.useEffect(() => {
		if (!guest) return;
		setPeopleInput(String(guest.maxAllowedAttendees));
		setCustomAttendeesError(null);
	}, [guest]);

	const handlePeopleChange = (value: string) => {
		setPeopleInput(value);
		const parsed = parseInt(value, 10);
		if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_CUSTOM_ATTENDEES) {
			setEditMaxAttendees(parsed);
			setCustomAttendeesError(null);
		}
	};

	if (!guest) {
		return (
			<ModalShell
				title={MODE_TITLES[mode]}
				onClose={onClose}
				footer={
					<button type="button" className="btn-primary" onClick={onClose}>
						Cerrar
					</button>
				}
			>
				<div className="dashboard-modal__content">
					<p className="dashboard-modal__confirm-text">
						{mode === 'pending-reminder'
							? 'No hay recordatorios pendientes por enviar.'
							: 'No hay invitaciones pendientes por enviar.'}
					</p>
				</div>
			</ModalShell>
		);
	}

	const subtitle = isQueueMode ? (
		<>
			{guest.fullName}
			<br />
			<span className="dashboard-modal__queue-count">
				{pendingCount}{' '}
				{isReminderMode
					? 'recordatorios pendientes'
					: pendingCount === 1
						? 'pendiente'
						: 'pendientes'}
			</span>
		</>
	) : (
		guest.fullName
	);

	const phoneValid = editPhone.trim().length > 0 && canSendToPhone;

	const renderFormSection = () => (
		<div className="send-invitation__form-section">
			<div className="dashboard-form-field send-invitation__field">
				<label htmlFor="send-name">Nombre del invitado</label>
				<input
					id="send-name"
					autoFocus
					value={editName}
					onChange={(e) => setEditName(e.target.value)}
					placeholder="Nombre completo"
					className="send-invitation__input"
				/>
			</div>

			<div className="dashboard-form-field send-invitation__field send-invitation__companion-section">
				<label htmlFor="send-people">¿Cuántas personas vienen?</label>
				<span id="send-people-hint" className="guest-field-hint">
					Incluya al invitado principal.
				</span>
				<GuestPeopleStepper
					id="send-people"
					value={peopleInput}
					max={MAX_CUSTOM_ATTENDEES}
					onChange={handlePeopleChange}
					describedBy="send-people-hint"
					invalid={Boolean(customAttendeesError)}
				/>
				{customAttendeesError && (
					<span className="guest-field-error">{customAttendeesError}</span>
				)}
			</div>

			<PhoneInputGroup
				id="send"
				countryCode={editCountryCode}
				phone={editPhone}
				onCountryCodeChange={setEditCountryCode}
				onPhoneChange={(val) => {
					setEditPhone(val);
				}}
				error={phoneError}
				label="Teléfono / WhatsApp"
				showOptional
			/>
			{!editPhone.trim() && !phoneError && (
				<span className="guest-field-hint">
					Sin teléfono registrado. Al compartir, WhatsApp le permitirá elegir el contacto.
				</span>
			)}
			<span className="guest-field-hint">
				Tip: Al abrirse WhatsApp, espere un momento a que aparezca la foto antes de
				presionar Enviar.
			</span>
		</div>
	);

	const renderMessageSection = () => (
		<div className="send-invitation__message-section">
			<div className="send-invitation__message-header">
				<span className="send-invitation__message-label">Mensaje</span>
				<span
					className={[
						'send-invitation__mode-label',
						editingMessage && 'send-invitation__mode-label--editing',
					]
						.filter(Boolean)
						.join(' ')}
				>
					{editingMessage ? 'Editando' : 'Vista previa'}
				</span>
			</div>

			{editingMessage ? (
				<>
					<div className="send-invitation__preview-card">
						<textarea
							className="send-invitation__textarea"
							rows={4}
							maxLength={500}
							autoFocus
							value={localMessageOverride}
							onChange={(e) => handleUpdateLocalMessage(e.target.value)}
						/>
					</div>
					{messageError && <p className="send-invitation__field-error">{messageError}</p>}
					<div className="send-invitation__edit-actions">
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={handleCancelEditMessage}
						>
							Cancelar edición
						</button>
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={handleResetMessage}
						>
							Restablecer desde plantilla
						</button>
					</div>
				</>
			) : (
				<>
					<div className="send-invitation__preview-card">
						<pre className="send-invitation__preview-text">{activeMessage}</pre>
					</div>
					<div className="send-invitation__preview-actions">
						<button
							type="button"
							className="send-invitation__preview-action"
							onClick={handleEditMessage}
						>
							Editar
						</button>
					</div>
				</>
			)}

			{copySuccess && (
				<span className="send-invitation__copy-feedback" role="status">
					Mensaje copiado
				</span>
			)}
		</div>
	);

	const renderFallbackSection = () =>
		fallbackGuest && (
			<div className="dashboard-modal__fallback">
				<p className="dashboard-modal__description">
					No se pudo abrir el método de envío. Puede copiar la
					{isReminderMode ? ' mensaje de recordatorio' : ' invitación'}.
				</p>
				<div className="send-share-guest">
					<span className="send-share-guest__name">{fallbackGuest.fullName}</span>
					{fallbackGuest.phone && (
						<span className="send-share-guest__phone">{fallbackGuest.phone}</span>
					)}
				</div>
				<div className="dashboard-modal__fallback-actions">
					<button type="button" className="btn-primary" onClick={handleCopyOnly}>
						<CopyIcon className="share-icon" size={16} />
						{isReminderMode ? 'Copiar recordatorio' : 'Copiar invitación'}
					</button>
					{!isReminderMode && (
						<button
							type="button"
							className="btn-primary"
							onClick={handleCopyAndMarkSent}
							disabled={advancing}
						>
							Copiar y marcar como enviada
						</button>
					)}
					<button
						type="button"
						className="btn-secondary btn-secondary--modal"
						onClick={handleKeepPending}
					>
						{isReminderMode ? 'Cerrar' : 'Mantener pendiente'}
					</button>
				</div>
				{markError && <span className="guest-field-error">{markError}</span>}
			</div>
		);

	const handleSaveWithCustomValidation = React.useCallback(() => {
		const parsed = parseInt(peopleInput.trim(), 10);
		if (isNaN(parsed) || parsed < 1) {
			setCustomAttendeesError('Indique cuántas personas vienen.');
			return;
		}
		if (parsed > MAX_CUSTOM_ATTENDEES) {
			setCustomAttendeesError('El valor excede el límite técnico permitido.');
			return;
		}
		setCustomAttendeesError(null);
		handleSaveAndShare();
	}, [peopleInput, handleSaveAndShare]);

	const ctaLabel = isReminderMode
		? 'Enviar recordatorio'
		: phoneValid
			? 'Compartir por WhatsApp'
			: 'Compartir invitación';

	const renderIdleFooter = () => (
		<>
			<button
				type="button"
				className="btn-secondary btn-secondary--modal dashboard-modal__footer-cancel"
				onClick={onClose}
			>
				Cancelar
			</button>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSaveWithCustomValidation}
				disabled={shareStatus !== 'idle'}
			>
				{phoneValid ? <WhatsAppIcon className="share-icon" size={16} /> : null}
				{ctaLabel}
			</button>
			<span className="send-invitation__footer-secondary">
				<button
					type="button"
					className="send-invitation__footer-text-link"
					onClick={handleCopyMessageAction}
					disabled={shareStatus !== 'idle'}
				>
					<CopyIcon size={14} />
					Copiar mensaje
				</button>
				{isQueueMode && pendingCount > 1 && (
					<button
						type="button"
						className="send-invitation__footer-text-link"
						onClick={handlePostpone}
						disabled={shareStatus !== 'idle'}
					>
						Enviar después
					</button>
				)}
			</span>
		</>
	);

	return (
		<ModalShell
			title={MODE_TITLES[mode]}
			subtitle={subtitle}
			className="dashboard-modal--send-invitation"
			onClose={onClose}
			footer={
				<>
					{shareStatus === 'idle' && renderIdleFooter()}
					{shareStatus === 'fallback' && (
						<button type="button" className="btn-primary" onClick={onClose}>
							Cerrar
						</button>
					)}
				</>
			}
		>
			<div className="dashboard-modal__content">
				{shareStatus === 'idle' && (
					<div
						className={`send-invitation${isReminderMode ? ' send-invitation--reminder' : ''}`}
					>
						{renderFormSection()}
						{templates && renderMessageSection()}
					</div>
				)}
				{shareStatus === 'fallback' && renderFallbackSection()}
			</div>
		</ModalShell>
	);
};

export default SendInvitationModal;
