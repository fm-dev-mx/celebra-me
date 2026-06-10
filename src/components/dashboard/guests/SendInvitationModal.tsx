import { useRef } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CopyIcon } from '@/components/common/icons/ui';
import { ATTENDEE_OPTIONS } from '@/components/dashboard/guests/guest-form-constants';
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
	inviteBaseUrl: string;
	onClose: () => void;
	onSave: GuestSaveCallback;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
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
	'single-reminder': 'Enviar recordatorio',
};

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
	guest,
	pendingGuests,
	inviteUrl,
	onClose,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
	templates,
	shareDateContext,
	eventTitle,
	mode = 'pending-invitation',
}) => {
	const editAreaRef = useRef<HTMLTextAreaElement>(null);

	const {
		editName,
		setEditName,
		editMaxAttendees,
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
		onAdvanceFromGuest,
		onPostponeGuest,
		templates,
		shareDateContext,
		eventTitle,
		mode,
	});

	if (!guest) {
		return (
			<ModalShell title={MODE_TITLES[mode]} onClose={onClose}>
				<div className="dashboard-modal__content">
					<p className="dashboard-modal__confirm-text">
						No hay invitaciones pendientes por enviar.
					</p>
				</div>
				<div className="dashboard-modal__footer">
					<button type="button" className="btn-primary" onClick={onClose}>
						Cerrar
					</button>
				</div>
			</ModalShell>
		);
	}

	const subtitle = isQueueMode
		? `${pendingCount} pendiente(s) · ${guest.fullName}`
		: guest.fullName;

	const hasPhoneValue = editPhone.trim().length > 0;
	const phoneValid = hasPhoneValue && canSendToPhone;
	const phoneEmpty = editPhone.trim().length === 0;

	const renderFormSection = () => (
		<div className="send-invitation__form-section">
			<div className="dashboard-form-field">
				<label htmlFor="send-name">Nombre del invitado</label>
				<input
					id="send-name"
					autoFocus
					value={editName}
					onChange={(e) => setEditName(e.target.value)}
					placeholder="Nombre completo"
				/>
			</div>

			<div className="dashboard-form-section">
				<h4 className="dashboard-form-section__title">Acompa&ntilde;antes permitidos</h4>
				<div className="dashboard-form-field dashboard-form-field--full">
					<div
						className="guest-response-cards guest-response-cards--compact"
						role="radiogroup"
						aria-label="Acompañantes permitidos"
					>
						{ATTENDEE_OPTIONS.map((num) => (
							<label key={num} className="guest-response-card">
								<input
									type="radio"
									name="sendMaxAttendees"
									value={num}
									checked={editMaxAttendees === num}
									onChange={() => setEditMaxAttendees(num)}
								/>
								<div className="guest-response-card__content">
									{num === 10 ? '10+' : num}
								</div>
							</label>
						))}
					</div>
				</div>
			</div>

			<div className="dashboard-form-field">
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
				{phoneEmpty && !phoneError && (
					<span className="guest-field-hint">
						Sin teléfono registrado. Al compartir, WhatsApp te permitirá elegir el
						contacto.
					</span>
				)}
			</div>
		</div>
	);

	const renderMessageSection = () => (
		<div className="send-invitation__message-section">
			<span className="send-invitation__message-label">Mensaje a enviar</span>

			<div className="send-invitation__preview-card">
				{editingMessage ? (
					<textarea
						ref={editAreaRef}
						className="send-invitation__textarea"
						rows={4}
						maxLength={500}
						autoFocus
						value={localMessageOverride}
						onChange={(e) => handleUpdateLocalMessage(e.target.value)}
					/>
				) : (
					<pre className="send-invitation__preview-text">{activeMessage}</pre>
				)}
			</div>

			{messageError && <p className="send-invitation__field-error">{messageError}</p>}

			<div className="send-invitation__edit-actions">
				{editingMessage ? (
					<>
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={handleCancelEditMessage}
						>
							Cancelar edici&oacute;n
						</button>
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={handleResetMessage}
						>
							Restablecer desde plantilla
						</button>
					</>
				) : (
					<button
						type="button"
						className="btn-secondary btn-secondary--modal"
						onClick={handleEditMessage}
					>
						Editar mensaje
					</button>
				)}
			</div>
		</div>
	);

	const renderFallbackSection = () =>
		fallbackGuest && (
			<div className="dashboard-modal__fallback">
				<p className="dashboard-modal__description">
					No se pudo abrir el m&eacute;todo de env&iacute;o. Puedes copiar la
					invitaci&oacute;n.
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
						Copiar invitaci&oacute;n
					</button>
					<button
						type="button"
						className="btn-primary"
						onClick={handleCopyAndMarkSent}
						disabled={advancing}
					>
						Copiar y marcar como enviada
					</button>
					<button
						type="button"
						className="btn-secondary btn-secondary--modal"
						onClick={handleKeepPending}
					>
						Mantener pendiente
					</button>
				</div>
				{markError && <span className="guest-field-error">{markError}</span>}
			</div>
		);

	const renderIdleFooter = () => (
		<>
			<button type="button" className="btn-secondary btn-secondary--modal" onClick={onClose}>
				Cancelar
			</button>
			{isQueueMode && pendingCount > 1 && (
				<button
					type="button"
					className="btn-secondary btn-secondary--postpone"
					onClick={handlePostpone}
				>
					Posponer
				</button>
			)}
			<button
				type="button"
				className="btn-secondary btn-secondary--modal"
				onClick={handleCopyMessageAction}
				disabled={shareStatus !== 'idle'}
			>
				<CopyIcon className="share-icon" size={16} />
				Copiar mensaje
			</button>
			<button
				type="button"
				className="btn-primary"
				onClick={handleSaveAndShare}
				disabled={shareStatus !== 'idle'}
			>
				{phoneValid ? <WhatsAppIcon className="share-icon" size={16} /> : null}
				Compartir
			</button>
		</>
	);

	return (
		<ModalShell
			title={MODE_TITLES[mode]}
			subtitle={subtitle}
			className="dashboard-modal--send-invitation"
			onClose={onClose}
		>
			<div className="dashboard-modal__content">
				{shareStatus === 'idle' && renderFormSection()}
				{shareStatus === 'idle' && templates && renderMessageSection()}
				{shareStatus === 'fallback' && renderFallbackSection()}
			</div>

			<div className="dashboard-modal__footer">
				{shareStatus === 'idle' && renderIdleFooter()}
				{shareStatus === 'fallback' && (
					<button type="button" className="btn-primary" onClick={onClose}>
						Cerrar
					</button>
				)}
			</div>
		</ModalShell>
	);
};

export default SendInvitationModal;
