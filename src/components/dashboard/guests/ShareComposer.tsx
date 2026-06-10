import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface ShareComposerProps {
	anchorRef: React.RefObject<HTMLElement | null>;
	guestName: string;
	phone: string;
	inviteUrl: string;
	eventTitle: string;
	templates: ShareMessagesConfig;
	defaultMessageType: ShareMessageType;
	onShared: () => Promise<void> | void;
	onClose: () => void;
}

const ShareComposer: React.FC<ShareComposerProps> = ({
	anchorRef,
	guestName,
	phone,
	inviteUrl,
	eventTitle,
	templates,
	defaultMessageType,
	onShared,
	onClose,
}) => {
	const [messageType, setMessageType] = useState<ShareMessageType>(defaultMessageType);
	const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
	const popoverRef = useRef<HTMLDivElement>(null);

	const context = { guestName, eventTitle, inviteUrl };
	const renderedMessage = renderShareMessage(
		messageType === 'invitation' ? templates.invitation : templates.reminder,
		context,
	);

	const hasPhone = !!phone?.trim();
	const waShareUrl = hasPhone
		? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(renderedMessage)}`
		: '';

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const popover = popoverRef.current;
		if (!anchor || !popover) return;
		const rect = anchor.getBoundingClientRect();
		popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
		popover.style.left = `${Math.max(8, rect.right + window.scrollX - 280)}px`;
	}, [anchorRef]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				anchorRef.current &&
				!anchorRef.current.contains(e.target as Node)
			) {
				onClose();
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [onClose, anchorRef]);

	const handleWhatsApp = async () => {
		if (!waShareUrl || status !== 'idle') return;
		setStatus('sending');
		window.open(waShareUrl, '_blank', 'noopener,noreferrer');
		await onShared();
		setStatus('done');
		setTimeout(onClose, 1200);
	};

	const handleCopyMessage = async () => {
		if (status !== 'idle') return;
		setStatus('sending');
		await copyToClipboard(renderedMessage);
		await onShared();
		setStatus('done');
		setTimeout(onClose, 1200);
	};

	const handleCopyLink = async () => {
		if (status !== 'idle') return;
		setStatus('sending');
		await copyToClipboard(inviteUrl);
		await onShared();
		setStatus('done');
		setTimeout(onClose, 1200);
	};

	const handleNativeShare = async () => {
		if (status !== 'idle') return;
		const payload = buildInvitationSharePayload({ shareText: renderedMessage, inviteUrl });
		if (!canUseNativeShare(payload)) return;
		setStatus('sending');
		const result = await shareInvitationLink(payload);
		if (result === 'shared') {
			await onShared();
			setStatus('done');
			setTimeout(onClose, 1200);
		} else {
			setStatus('idle');
		}
	};

	const supportsNativeShare = canUseNativeShare(
		buildInvitationSharePayload({ shareText: renderedMessage, inviteUrl }),
	);

	const statusLabel = status === 'done' ? 'Listo' : status === 'sending' ? 'Enviando...' : '';

	return createPortal(
		<div
			ref={popoverRef}
			className="share-composer"
			role="dialog"
			aria-label="Compartir invitación"
		>
			<div className="share-composer__type-toggle">
				<button
					type="button"
					className={`share-composer__type-btn ${messageType === 'invitation' ? 'share-composer__type-btn--active' : ''}`}
					onClick={() => setMessageType('invitation')}
				>
					Invitación
				</button>
				<button
					type="button"
					className={`share-composer__type-btn ${messageType === 'reminder' ? 'share-composer__type-btn--active' : ''}`}
					onClick={() => setMessageType('reminder')}
				>
					Recordatorio
				</button>
			</div>

			<pre className="share-composer__preview">{renderedMessage}</pre>

			<div className="share-composer__actions">
				{hasPhone && (
					<button
						type="button"
						className="share-composer__action share-composer__action--whatsapp"
						onClick={handleWhatsApp}
						disabled={status !== 'idle'}
					>
						<WhatsAppIcon size={16} />
						<span>WhatsApp</span>
					</button>
				)}
				<button
					type="button"
					className="share-composer__action"
					onClick={handleCopyMessage}
					disabled={status !== 'idle'}
				>
					{status === 'done' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
					<span>Copiar mensaje</span>
				</button>
				{supportsNativeShare && (
					<button
						type="button"
						className="share-composer__action"
						onClick={handleNativeShare}
						disabled={status !== 'idle'}
					>
						<CopyIcon size={16} />
						<span>Compartir...</span>
					</button>
				)}
				<button
					type="button"
					className="share-composer__action share-composer__action--link"
					onClick={handleCopyLink}
					disabled={status !== 'idle'}
				>
					{status === 'done' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
					<span>Copiar enlace</span>
				</button>
			</div>

			{statusLabel && <span className="share-composer__status">{statusLabel}</span>}
		</div>,
		document.body,
	);
};

export default ShareComposer;
