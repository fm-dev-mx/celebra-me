import { useEffect, useRef, useState } from 'react';
import { CopyIcon, MessageIcon } from '@/components/common/icons/ui';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import {
	buildInvitationSharePayload,
	canUseNativeShare,
	shareInvitationLink,
} from '@/components/dashboard/guests/invitation-share';
import { copyToClipboard } from '@/utils/clipboard';

interface ShareActionProps {
	phone: string;
	waShareUrl: string;
	inviteUrl: string;
	shareText: string;
	isShared?: boolean;
	onShared: () => Promise<void> | void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';

const ICONS: Record<string, React.ReactNode> = {
	whatsapp: <WhatsAppIcon className="share-icon" size={16} />,
	copy: <CopyIcon className="share-icon" size={16} />,
	'web-share': <MessageIcon className="share-icon" size={16} />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
	sending: <span className="share-icon share-icon--state">...</span>,
	delivered: <span className="share-icon share-icon--state">OK</span>,
};

const ShareAction: React.FC<ShareActionProps> = ({
	phone,
	waShareUrl,
	inviteUrl,
	shareText,
	isShared,
	onShared,
}) => {
	const [status, setStatus] = useState<ShareStatus>('idle');
	const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
		};
	}, []);

	const hasPhoneAndWa = !!(phone && waShareUrl);
	const sharePayload = buildInvitationSharePayload({ shareText, inviteUrl });
	const supportsWebShare = canUseNativeShare(sharePayload);

	const primaryAction = hasPhoneAndWa ? 'whatsapp' : supportsWebShare ? 'web-share' : 'copy';

	const handleShare = async () => {
		if (status !== 'idle') return;

		setStatus('sending');

		try {
			if (primaryAction === 'whatsapp') {
				window.open(waShareUrl, '_blank', 'noopener,noreferrer');
				await onShared();
			} else if (primaryAction === 'web-share') {
				const shareResult = await shareInvitationLink(sharePayload);
				if (shareResult === 'canceled') {
					setStatus('idle');
					return;
				}
				if (shareResult !== 'shared') {
					throw new Error(`Native share ${shareResult}`);
				}
				await onShared();
			} else {
				const copied = await copyToClipboard(inviteUrl);
				if (!copied) {
					window.open(inviteUrl, '_blank', 'noopener,noreferrer');
				}
				await onShared();
			}

			setStatus('delivered');
			statusTimeoutRef.current = setTimeout(() => setStatus('idle'), 3000);
		} catch (err) {
			console.info('Share action aborted or failed:', err);
			setStatus('idle');
		}
	};

	const statusIcon = STATUS_ICONS[status] ?? ICONS[primaryAction];
	const label =
		status === 'sending'
			? 'Enviando'
			: status === 'delivered'
				? 'Registrado'
				: primaryAction === 'whatsapp'
					? isShared
						? 'Reenviar'
						: 'Enviar'
					: primaryAction === 'copy'
						? 'Copiar enlace'
						: 'Compartir invitación';

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
			{statusIcon}
			<span className="share-label">{label}</span>
		</button>
	);
};

export default ShareAction;
