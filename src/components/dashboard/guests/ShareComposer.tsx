import React, { useEffect, useMemo, useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/common/icons/ui';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import {
	buildInvitationSharePayload,
	canUseNativeShare,
	shareInvitationLink,
} from '@/components/dashboard/guests/invitation-share';
import { copyToClipboard } from '@/utils/clipboard';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import { buildWhatsAppNumber } from '@/lib/phone/validation';
import ModalShell from '@/components/dashboard/ModalShell';

interface ShareComposerProps {
	guestName: string;
	phone: string;
	countryCode?: string;
	inviteUrl: string;
	eventTitle: string;
	templates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	defaultMessageType: ShareMessageType;
	onShared: () => Promise<void> | void;
	onClose: () => void;
}

const ShareComposer: React.FC<ShareComposerProps> = ({
	guestName,
	phone,
	countryCode,
	inviteUrl,
	eventTitle,
	templates,
	shareDateContext,
	defaultMessageType,
	onShared,
	onClose,
}) => {
	const [messageType, setMessageType] = useState<ShareMessageType>(defaultMessageType);
	const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');

	const context = useMemo(
		() => ({ guestName, eventTitle, inviteUrl, ...shareDateContext }),
		[guestName, eventTitle, inviteUrl, shareDateContext],
	);
	const renderedMessage = useMemo(
		() =>
			renderShareMessage(
				messageType === 'invitation' ? templates.invitation : templates.reminder,
				context,
			),
		[messageType, templates, context],
	);

	const hasPhone = !!phone?.trim();
	const waPhoneNumber = hasPhone ? buildWhatsAppNumber(phone, countryCode) : '';
	const waShareUrl = waPhoneNumber
		? `https://wa.me/${waPhoneNumber}?text=${encodeURIComponent(renderedMessage)}`
		: '';

	const invitationPayload = useMemo(
		() => buildInvitationSharePayload({ shareText: renderedMessage, inviteUrl }),
		[renderedMessage, inviteUrl],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	const finishShare = () => {
		setStatus('done');
		setTimeout(onClose, 1200);
	};

	const withStatus = async (action: () => Promise<void>) => {
		if (status !== 'idle') return;
		setStatus('sending');
		await action();
		await onShared();
		finishShare();
	};

	const handleWhatsApp = async () => {
		if (!waShareUrl) return;
		await withStatus(async () => {
			window.open(waShareUrl, '_blank', 'noopener,noreferrer');
		});
	};

	const handleCopy = async (text: string) => {
		await withStatus(async () => {
			await copyToClipboard(text);
		});
	};

	const handleNativeShare = async () => {
		if (status !== 'idle') return;
		if (!canUseNativeShare(invitationPayload)) return;
		setStatus('sending');
		const result = await shareInvitationLink(invitationPayload);
		if (result === 'shared') {
			await onShared();
			finishShare();
		} else {
			setStatus('idle');
		}
	};

	const supportsNativeShare = canUseNativeShare(invitationPayload);

	const handleSelectInvitation = () => setMessageType('invitation');
	const handleSelectReminder = () => setMessageType('reminder');
	const handleCopyMessage = () => handleCopy(renderedMessage);
	const handleCopyLink = () => handleCopy(inviteUrl);

	const STATUS_LABELS: Record<string, string> = {
		idle: '',
		sending: 'Enviando...',
		done: 'Listo',
	};
	const statusLabel = STATUS_LABELS[status];

	const subtitle = hasPhone
		? `Para: ${guestName} · WhatsApp disponible`
		: `Para: ${guestName} · Sin teléfono registrado`;

	const tabPanelId = 'share-composer-tabpanel';
	const isInvitation = messageType === 'invitation';

	return (
		<ModalShell
			title="Compartir invitación"
			subtitle={subtitle}
			className="dashboard-modal--share-composer"
			onClose={onClose}
		>
			<div className="dashboard-modal__content">
				<div
					className="share-composer-modal__tabs"
					role="tablist"
					aria-label="Tipo de mensaje"
				>
					<button
						type="button"
						role="tab"
						id="share-composer-tab-invitation"
						aria-selected={isInvitation}
						aria-controls={tabPanelId}
						className={`share-composer-modal__tab ${isInvitation ? 'share-composer-modal__tab--active' : ''}`}
						onClick={handleSelectInvitation}
					>
						Invitación
					</button>
					<button
						type="button"
						role="tab"
						id="share-composer-tab-reminder"
						aria-selected={messageType === 'reminder'}
						aria-controls={tabPanelId}
						className={`share-composer-modal__tab ${messageType === 'reminder' ? 'share-composer-modal__tab--active' : ''}`}
						onClick={handleSelectReminder}
					>
						Recordatorio
					</button>
				</div>

				<div
					className="share-composer-modal__preview-card"
					role="tabpanel"
					id={tabPanelId}
					aria-labelledby={
						isInvitation
							? 'share-composer-tab-invitation'
							: 'share-composer-tab-reminder'
					}
				>
					<pre className="share-composer-modal__preview-text">{renderedMessage}</pre>
				</div>
			</div>

			<div className="dashboard-modal__footer">
				<div className="share-composer-modal__actions">
					{hasPhone ? (
						<>
							<button
								type="button"
								className="share-composer-modal__action share-composer-modal__action--whatsapp"
								onClick={handleWhatsApp}
								disabled={status !== 'idle'}
							>
								<WhatsAppIcon size={16} />
								<span>Enviar por WhatsApp</span>
							</button>
							<button
								type="button"
								className="share-composer-modal__action share-composer-modal__action--secondary"
								onClick={handleCopyMessage}
								disabled={status !== 'idle'}
							>
								{status === 'done' ? (
									<CheckIcon size={16} />
								) : (
									<CopyIcon size={16} />
								)}
								<span>Copiar mensaje</span>
							</button>
						</>
					) : (
						<button
							type="button"
							className="share-composer-modal__action share-composer-modal__action--primary"
							onClick={handleCopyMessage}
							disabled={status !== 'idle'}
						>
							{status === 'done' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
							<span>Copiar mensaje</span>
						</button>
					)}
					<button
						type="button"
						className="share-composer-modal__action share-composer-modal__action--tertiary"
						onClick={handleCopyLink}
						disabled={status !== 'idle'}
					>
						{status === 'done' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
						<span>Copiar enlace</span>
					</button>
					{supportsNativeShare && (
						<button
							type="button"
							className="share-composer-modal__action share-composer-modal__action--tertiary"
							onClick={handleNativeShare}
							disabled={status !== 'idle'}
						>
							<CopyIcon size={16} />
							<span>Compartir...</span>
						</button>
					)}
				</div>
				{statusLabel && <span className="share-composer-modal__status">{statusLabel}</span>}
			</div>
		</ModalShell>
	);
};

export default ShareComposer;
