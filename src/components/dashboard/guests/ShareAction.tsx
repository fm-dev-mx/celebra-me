import React, { useMemo, useState } from 'react';
import { CopyIcon, MessageIcon } from '@/components/common/icons/ui';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';

interface ShareActionProps {
	phone: string;
	waShareUrl: string;
	inviteUrl: string;
	shareText: string;
	isShared?: boolean;
	onShared: () => Promise<void> | void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';
type ShareMethod = 'whatsapp' | 'web-share' | 'copy';

const ShareAction: React.FC<ShareActionProps> = ({
	phone,
	waShareUrl,
	inviteUrl,
	shareText,
	isShared,
	onShared,
}) => {
	const [status, setStatus] = useState<ShareStatus>('idle');

	const hasPhoneAndWa = useMemo(() => !!(phone && waShareUrl), [phone, waShareUrl]);

	// Guarded access to navigator for environments where it's undefined (tests/SSR-ish cases).
	const supportsWebShare = useMemo(() => {
		if (typeof navigator === 'undefined') return false;
		return !!(navigator.share && typeof navigator.share === 'function');
	}, []);

	const primaryAction: ShareMethod = useMemo(() => {
		if (hasPhoneAndWa) return 'whatsapp';
		if (supportsWebShare) return 'web-share';
		return 'copy';
	}, [hasPhoneAndWa, supportsWebShare]);

	const handleShare = async () => {
		if (status !== 'idle') return;

		setStatus('sending');

		try {
			if (primaryAction === 'whatsapp') {
				window.open(waShareUrl, '_blank', 'noopener,noreferrer');
				await onShared();
			} else if (primaryAction === 'web-share') {
				await navigator.share({
					title: 'Invitación Celebra-me',
					text: shareText,
					url: inviteUrl,
				});
				await onShared();
			} else {
				if (!navigator.clipboard?.writeText) {
					window.open(inviteUrl, '_blank', 'noopener,noreferrer');
				} else {
					await navigator.clipboard.writeText(inviteUrl);
				}
				await onShared();
			}

			setStatus('delivered');
			window.setTimeout(() => setStatus('idle'), 3000);
		} catch (err) {
			console.info('Share action aborted or failed:', err);
			setStatus('idle');
		}
	};

	const getButtonLabel = () => {
		if (status === 'sending') return 'Enviando';
		if (status === 'delivered') return 'Registrado';
		if (primaryAction === 'whatsapp') return isShared ? 'Reenviar' : 'Enviar';
		if (primaryAction === 'copy') return 'Copiar enlace';
		return 'Compartir invitación';
	};

	const renderButtonIcon = () => {
		if (status === 'delivered') {
			return <span className="share-icon share-icon--state">OK</span>;
		}

		if (status === 'sending') {
			return <span className="share-icon share-icon--state">...</span>;
		}

		if (primaryAction === 'whatsapp') {
			return <WhatsAppIcon className="share-icon" size={16} />;
		}

		if (primaryAction === 'copy') {
			return <CopyIcon className="share-icon" size={16} />;
		}

		return <MessageIcon className="share-icon" size={16} />;
	};

	const title =
		primaryAction === 'whatsapp'
			? 'Enviar por WhatsApp'
			: primaryAction === 'web-share'
				? 'Compartir invitación'
				: 'Copiar enlace';

	return (
		<button
			type="button"
			className={`dashboard-guests__share-button dashboard-guests__share-button--${status} ${isShared && status === 'idle' ? 'dashboard-guests__share-button--shared' : ''}`}
			onClick={handleShare}
			disabled={status !== 'idle'}
			title={title}
			aria-label={title}
		>
			{renderButtonIcon()}
			<span className="share-label">{getButtonLabel()}</span>
		</button>
	);
};

export default ShareAction;
