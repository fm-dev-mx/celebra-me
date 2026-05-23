import React from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CopyIcon, MessageIcon } from '@/components/common/icons/ui';
import { ATTENDEE_OPTIONS } from '@/components/dashboard/guests/guest-form-constants';
import { useSendInvitation } from '@/components/dashboard/guests/use-send-invitation';
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
}

const EmptyState: React.FC<{ onClose: () => void }> = ({ onClose }) => (
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

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
	guest,
	pendingGuests,
	inviteBaseUrl,
	onClose,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
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
	});

	if (!guest) {
		return <EmptyState onClose={onClose} />;
	}

	return (
		<ModalShell title="Enviar invitación" onClose={onClose}>
			<div className="dashboard-modal__content">
				{shareStatus === 'idle' && (
					<>
						<p className="dashboard-modal__description">
							{pendingCount} invitaci&oacute;n(es) pendiente(s) por enviar
						</p>

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

						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="send-attendees">
								Cu&aacute;ntos acompa&ntilde;antes permite
							</label>
							<div className="guest-response-cards guest-response-cards--compact">
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
					</>
				)}

				{shareStatus === 'fallback' && fallbackGuest && (
					<div className="dashboard-modal__fallback">
						<p className="dashboard-modal__description">
							No se pudo abrir el m&eacute;todo de env&iacute;o. Puedes copiar la
							invitaci&oacute;n.
						</p>
						<div className="send-share-guest">
							<span className="send-share-guest__name">{fallbackGuest.fullName}</span>
							{fallbackGuest.phone && (
								<span className="send-share-guest__phone">
									{fallbackGuest.phone}
								</span>
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
				)}
			</div>
			<div className="dashboard-modal__footer">
				{shareStatus === 'idle' && (
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
						<button type="button" className="btn-primary" onClick={handleSaveAndShare}>
							{canSendToPhone ? (
								<WhatsAppIcon className="share-icon" size={16} />
							) : (
								<MessageIcon className="share-icon" size={16} />
							)}
							{canSendToPhone ? 'Enviar por WhatsApp' : 'Compartir invitaci\u00f3n'}
						</button>
					</>
				)}
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
