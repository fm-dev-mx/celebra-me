import { useRef } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CopyIcon } from '@/components/common/icons/ui';
import { ATTENDEE_OPTIONS } from '@/components/dashboard/guests/guest-form-constants';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface SendInvitationModalProps {
	guest: DashboardGuestItem | null;
	pendingGuests: DashboardGuestItem[];
	inviteBaseUrl: string;
	onClose: () => void;
	onSave: (
		guestId: string,
		payload: {
			fullName: string;
			maxAllowedAttendees: number;
			phone?: string | null;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onAdvanceFromGuest: (currentGuestId: string) => void;
	onPostponeGuest: (currentGuestId: string) => void;
	templates?: ShareMessagesConfig;
	shareDateContext?: ShareMessageDateContext;
	eventTitle?: string;
}

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
	guest,
	pendingGuests,
	inviteBaseUrl,
	onClose,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
	templates,
	shareDateContext,
	eventTitle,
}) => {
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
		setPhoneError,
		shareStatus,
		fallbackGuest,
		markError,
		advancing,
		pendingCount,
		canSendToPhone,
		flowStep,
		editingMessage,
		activeMessage,
		handleContinueToMessage,
		handleEditMessage,
		handleCancelEditMessage,
		handleResetMessage,
		handleUpdateLocalMessage,
		localMessageOverride,
		handleBackToForm,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	} = useSendInvitation({
		guest,
		pendingGuests,
		inviteBaseUrl,
		onSave,
		onMarkShared,
		onAdvanceFromGuest,
		onPostponeGuest,
		templates,
		shareDateContext,
		eventTitle,
	});

	const editAreaRef = useRef<HTMLTextAreaElement>(null);

	const modalContent = (() => {
		if (shareStatus === 'idle' && flowStep === 'form') {
			return (
				<>
					<p className="dashboard-modal__description">
						{pendingCount} invitaci&oacute;n(es) pendiente(s) por enviar
					</p>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleContinueToMessage();
						}}
					>
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
							<h4 className="dashboard-form-section__title">
								Acompa&ntilde;antes permitidos
							</h4>
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
								onCountryCodeChange={(val) => {
									setEditCountryCode(val);
									if (phoneError) setPhoneError(null);
								}}
								onPhoneChange={(val) => {
									setEditPhone(val);
									if (phoneError) setPhoneError(null);
								}}
								error={phoneError}
								label="Teléfono / WhatsApp"
								showOptional
							/>
						</div>
					</form>
				</>
			);
		}
		if (shareStatus === 'idle' && flowStep === 'message' && templates) {
			return (
				<div className="send-invitation-message-step">
					<p className="dashboard-modal__description">
						Revisa el mensaje antes de enviarlo.
					</p>
					<span className="send-invitation-message-step__label">Mensaje a enviar</span>
					<div className="send-invitation-message-step__preview-card">
						{editingMessage ? (
							<textarea
								ref={editAreaRef}
								className="send-invitation-message-step__textarea"
								rows={5}
								maxLength={500}
								value={localMessageOverride}
								onChange={(e) => handleUpdateLocalMessage(e.target.value)}
							/>
						) : (
							<pre className="send-invitation-message-step__preview-text">
								{activeMessage}
							</pre>
						)}
					</div>
					<div className="send-invitation-message-step__actions">
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
					{canSendToPhone && (
						<div className="send-invitation-message-step__phone-info">
							<WhatsAppIcon size={14} />
							Se enviar&aacute; por WhatsApp al n&uacute;mero registrado.
						</div>
					)}
				</div>
			);
		}
		if (shareStatus === 'fallback' && fallbackGuest) {
			return (
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
		}
		return null;
	})();

	const modalFooter = (() => {
		if (shareStatus === 'idle' && flowStep === 'form') {
			return (
				<>
					<button
						type="button"
						className="btn-secondary btn-secondary--modal"
						onClick={onClose}
					>
						Cancelar
					</button>
					{pendingCount > 1 && (
						<button
							type="button"
							className="btn-secondary btn-secondary--postpone"
							onClick={handlePostpone}
						>
							Posponer
						</button>
					)}
					<button type="button" className="btn-primary" onClick={handleContinueToMessage}>
						Continuar
					</button>
				</>
			);
		}
		if (shareStatus === 'idle' && flowStep === 'message') {
			return (
				<>
					<button
						type="button"
						className="btn-secondary btn-secondary--modal"
						onClick={handleBackToForm}
					>
						Volver
					</button>
					{canSendToPhone ? (
						<button
							type="button"
							className="btn-primary"
							onClick={() => {
								handleSaveAndShare();
							}}
							disabled={shareStatus !== 'idle'}
						>
							<WhatsAppIcon className="share-icon" size={16} />
							Enviar por WhatsApp
						</button>
					) : (
						<button
							type="button"
							className="btn-primary"
							onClick={() => {
								handleSaveAndShare();
							}}
							disabled={shareStatus !== 'idle'}
						>
							<CopyIcon className="share-icon" size={16} />
							Copiar mensaje
						</button>
					)}
				</>
			);
		}
		if (shareStatus === 'fallback') {
			return (
				<button type="button" className="btn-primary" onClick={onClose}>
					Cerrar
				</button>
			);
		}
		return null;
	})();

	if (!guest) {
		return (
			<ModalShell title="Enviar invitación" onClose={onClose}>
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

	return (
		<ModalShell title="Enviar invitación" onClose={onClose}>
			<div className="dashboard-modal__content">{modalContent}</div>
			<div className="dashboard-modal__footer">{modalFooter}</div>
		</ModalShell>
	);
};

export default SendInvitationModal;
