import React, { useCallback, useMemo, useState } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CopyIcon, MessageIcon } from '@/components/common/icons/ui';
import { getGuestInviteUrl, validatePhone } from '@/components/dashboard/guests/guest-presenter';
import {
	ATTENDEE_OPTIONS,
	COUNTRY_OPTIONS,
} from '@/components/dashboard/guests/guest-form-constants';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

type Phase = 'form' | 'done';

type ShareStatus = 'idle' | 'saving' | 'fallback';

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
			phone?: string;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
	guest,
	pendingGuests,
	inviteBaseUrl,
	onClose,
	onSave,
	onMarkShared,
}) => {
	const [phase, setPhase] = useState<Phase>('form');
	const [editName, setEditName] = useState('');
	const [editMaxAttendees, setEditMaxAttendees] = useState(1);
	const [editPhone, setEditPhone] = useState('');
	const [editCountryCode, setEditCountryCode] = useState('+52');
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
	const [fallbackGuest, setFallbackGuest] = useState<DashboardGuestItem | null>(null);
	const [markError, setMarkError] = useState<string | null>(null);
	const [advancing, setAdvancing] = useState(false);
	const pendingCount = useMemo(
		() => pendingGuests.filter((item) => item.deliveryStatus === 'generated').length,
		[pendingGuests],
	);

	const hasValidPhone = useMemo(() => {
		const trimmed = editPhone.trim();
		if (!trimmed) return false;
		return validatePhone(trimmed);
	}, [editPhone]);

	React.useEffect(() => {
		if (!guest) return;
		setEditName(guest.fullName);
		setEditMaxAttendees(guest.maxAllowedAttendees);
		setEditPhone(guest.phone || '');
		setEditCountryCode(guest.phoneCountryCode || '+52');
		setPhoneError(null);
		setPhase('form');
		setShareStatus('idle');
		setFallbackGuest(null);
		setMarkError(null);
		setAdvancing(false);
	}, [guest]);

	const advanceToNext = useCallback(() => {
		if (!guest) return;
		const next = pendingGuests.find(
			(p) => p.deliveryStatus === 'generated' && p.guestId !== guest.guestId,
		);
		if (next) {
			setEditName(next.fullName);
			setEditMaxAttendees(next.maxAllowedAttendees);
			setEditPhone(next.phone || '');
			setEditCountryCode(next.phoneCountryCode || '+52');
			setPhoneError(null);
			setPhase('form');
			setShareStatus('idle');
			setFallbackGuest(null);
			setMarkError(null);
			setAdvancing(false);
		} else {
			setPhase('done');
			setAdvancing(false);
		}
	}, [guest, pendingGuests]);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		const trimmed = editPhone.trim();
		if (trimmed && !validatePhone(trimmed)) {
			setPhoneError('El teléfono debe tener 10 dígitos.');
			return;
		}
		setPhoneError(null);
		setShareStatus('saving');
		setMarkError(null);

		// Pre-open blank window for WhatsApp (synchronous, preserves user gesture).
		// Deliberately omit 'noopener' so the returned handle stays non-null and
		// allows setting location.href after the async save.
		let waWindow: Window | null = null;
		if (hasValidPhone) {
			try {
				waWindow = window.open('', '_blank');
			} catch {
				// popup blocked — will show fallback
			}
		}

		try {
			const updated = await onSave(guest.guestId, {
				fullName: editName.trim() || guest.fullName,
				maxAllowedAttendees: editMaxAttendees,
				phone: editPhone.trim() || undefined,
				countryCode: editCountryCode,
			});

			const inviteUrl = getGuestInviteUrl(updated, inviteBaseUrl);
			setFallbackGuest(updated);

			if (hasValidPhone && updated.waShareUrl) {
				if (waWindow && !waWindow.closed) {
					waWindow.location.href = updated.waShareUrl;
					try {
						await onMarkShared(updated);
						advanceToNext();
					} catch {
						setMarkError('Error al registrar el envío.');
						setShareStatus('fallback');
					}
				} else {
					setShareStatus('fallback');
				}
			} else {
				try {
					if (typeof navigator !== 'undefined' && navigator.share) {
						await navigator.share({
							title: 'Invitación Celebra-me',
							text: updated.shareText,
							url: inviteUrl,
						});
						try {
							await onMarkShared(updated);
							advanceToNext();
						} catch {
							setMarkError('Error al registrar el envío.');
							setShareStatus('fallback');
						}
					} else {
						throw new Error('Web Share not supported');
					}
				} catch {
					setShareStatus('fallback');
				}
			}
		} catch {
			setPhoneError('Error al guardar los datos. Intenta de nuevo.');
			waWindow?.close();
			setShareStatus('idle');
		}
	}, [
		guest,
		shareStatus,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		hasValidPhone,
		onSave,
		inviteBaseUrl,
		onMarkShared,
		advanceToNext,
	]);

	const handleCopyOnly = useCallback(async () => {
		if (!fallbackGuest) return;
		const inviteUrl = getGuestInviteUrl(fallbackGuest, inviteBaseUrl);
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(inviteUrl);
			} else {
				window.open(inviteUrl, '_blank', 'noopener,noreferrer');
			}
		} catch {
			// copy failed silently
		}
	}, [fallbackGuest, inviteBaseUrl]);

	const handleCopyAndMarkSent = useCallback(async () => {
		if (!fallbackGuest || advancing) return;
		setAdvancing(true);
		setMarkError(null);
		try {
			const inviteUrl = getGuestInviteUrl(fallbackGuest, inviteBaseUrl);
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(inviteUrl);
			} else {
				window.open(inviteUrl, '_blank', 'noopener,noreferrer');
			}
			await onMarkShared(fallbackGuest);
			advanceToNext();
		} catch {
			setMarkError('Error al registrar el envío.');
			setAdvancing(false);
		}
	}, [fallbackGuest, advancing, inviteBaseUrl, onMarkShared, advanceToNext]);

	const handleKeepPending = useCallback(() => {
		setShareStatus('idle');
		setFallbackGuest(null);
		setMarkError(null);
	}, []);

	const handlePostpone = useCallback(() => {
		if (!guest) return;
		const next = pendingGuests.find(
			(p) => p.deliveryStatus === 'generated' && p.guestId !== guest.guestId,
		);
		if (next) {
			setEditName(next.fullName);
			setEditMaxAttendees(next.maxAllowedAttendees);
			setEditPhone(next.phone || '');
			setEditCountryCode(next.phoneCountryCode || '+52');
			setPhoneError(null);
			setPhase('form');
			setShareStatus('idle');
			setFallbackGuest(null);
			setMarkError(null);
		} else {
			setPhase('done');
		}
	}, [guest, pendingGuests]);

	if (!guest) {
		return (
			<DashboardModalPortal>
				<div
					className="dashboard-modal-backdrop"
					role="dialog"
					aria-modal="true"
					onClick={(e) => {
						if (e.target === e.currentTarget) onClose();
					}}
				>
					<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
						<div className="dashboard-modal__header">
							<h3>Enviar invitaci&oacute;n</h3>
							<button
								type="button"
								className="btn-close"
								onClick={onClose}
								aria-label="Cerrar modal"
							>
								✕
							</button>
						</div>
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
					</div>
				</div>
			</DashboardModalPortal>
		);
	}

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				role="dialog"
				aria-modal="true"
				onClick={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
			>
				<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
					<div className="dashboard-modal__header">
						<h3>Enviar invitaci&oacute;n</h3>
						<button
							type="button"
							className="btn-close"
							onClick={onClose}
							aria-label="Cerrar modal"
						>
							✕
						</button>
					</div>
					<div className="dashboard-modal__content">
						{phase === 'form' && shareStatus === 'idle' && (
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
									<label htmlFor="send-phone">
										Tel&eacute;fono (WhatsApp){' '}
										<span className="field-optional">opcional</span>
									</label>
									<div className="phone-input-group">
										<select
											id="send-country"
											className="phone-prefix"
											value={editCountryCode}
											onChange={(e) => setEditCountryCode(e.target.value)}
										>
											{COUNTRY_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</select>
										<input
											id="send-phone"
											className="phone-number"
											type="tel"
											value={editPhone}
											onChange={(e) => {
												const val = e.target.value.replace(/[^\d+ ]/g, '');
												setEditPhone(val);
												if (phoneError) setPhoneError(null);
											}}
											placeholder="N&uacute;mero de tel&eacute;fono"
										/>
									</div>
									{phoneError && (
										<span className="guest-field-error">{phoneError}</span>
									)}
								</div>
							</>
						)}

						{shareStatus === 'fallback' && fallbackGuest && (
							<div className="dashboard-modal__fallback">
								<p className="dashboard-modal__description">
									No se pudo abrir el m&eacute;todo de env&iacute;o. Puedes copiar
									la invitaci&oacute;n.
								</p>
								<div className="send-share-guest">
									<span className="send-share-guest__name">
										{fallbackGuest.fullName}
									</span>
									{fallbackGuest.phone && (
										<span className="send-share-guest__phone">
											{fallbackGuest.phone}
										</span>
									)}
								</div>
								<div className="dashboard-modal__fallback-actions">
									<button
										type="button"
										className="btn-primary"
										onClick={handleCopyOnly}
									>
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
								{markError && (
									<span className="guest-field-error">{markError}</span>
								)}
							</div>
						)}

						{phase === 'done' && (
							<p className="dashboard-modal__confirm-text">
								{pendingCount === 0
									? 'No hay m&aacute;s invitaciones pendientes por enviar.'
									: 'Todas las invitaciones han sido enviadas.'}
							</p>
						)}
					</div>
					<div className="dashboard-modal__footer">
						{phase === 'form' && shareStatus === 'idle' && (
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
								<button
									type="button"
									className="btn-primary"
									onClick={handleSaveAndShare}
								>
									{hasValidPhone ? (
										<WhatsAppIcon className="share-icon" size={16} />
									) : (
										<MessageIcon className="share-icon" size={16} />
									)}
									{hasValidPhone
										? 'Enviar por WhatsApp'
										: 'Compartir invitaci\u00f3n'}
								</button>
							</>
						)}
						{(shareStatus === 'fallback' || phase === 'done') && (
							<button type="button" className="btn-primary" onClick={onClose}>
								Cerrar
							</button>
						)}
					</div>
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default SendInvitationModal;
