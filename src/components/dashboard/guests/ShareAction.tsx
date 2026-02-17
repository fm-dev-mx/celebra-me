import React, { useMemo, useState } from 'react';

interface ShareActionProps {
	phone: string;
	waShareUrl: string;
	inviteUrl: string;
	shareText: string;
	onShared: () => Promise<void> | void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';
type ShareMethod = 'whatsapp' | 'web-share' | 'copy';

const ShareAction: React.FC<ShareActionProps> = ({
	phone,
	waShareUrl,
	inviteUrl,
	shareText,
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
		let didSucceed = false;

		try {
			if (primaryAction === 'whatsapp') {
				window.open(waShareUrl, '_blank', 'noopener,noreferrer');
				await onShared();
				didSucceed = true;
			} else if (primaryAction === 'web-share') {
				// supportsWebShare already checked, but keep defensive guard.
				if (!supportsWebShare) throw new Error('Web Share not supported');
				await navigator.share({
					title: 'Invitación Celebra-me',
					text: shareText,
					url: inviteUrl,
				});
				await onShared();
				didSucceed = true;
			} else {
				// copy
				if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
					// Very old browsers: fallback to opening the link rather than failing silently.
					window.open(inviteUrl, '_blank', 'noopener,noreferrer');
				} else {
					await navigator.clipboard.writeText(inviteUrl);
				}
				await onShared();
				didSucceed = true;
			}

			if (didSucceed) {
				setStatus('delivered');
				window.setTimeout(() => setStatus('idle'), 3000);
			} else {
				setStatus('idle');
			}
		} catch (err) {
			// Share can be aborted by user (Web Share) or blocked by browser; keep it quiet.
			console.info('Share action aborted or failed:', err);
			setStatus('idle');
		}
	};

	const getButtonLabel = () => {
		if (status === 'sending') return 'Enviando...';
		if (status === 'delivered') return 'Enviado';
		return primaryAction === 'whatsapp' ? 'WhatsApp' : 'Compartir';
	};

	const getButtonIcon = () => {
		if (status === 'delivered') return '✓';
		if (status === 'sending') return '⟳';
		return primaryAction === 'whatsapp' ? '💬' : '📤';
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
			className={`dashboard-guests__share-button dashboard-guests__share-button--${status}`}
			onClick={handleShare}
			disabled={status !== 'idle'}
			title={title}
			aria-label={title}
		>
			<span className="share-icon">{getButtonIcon()}</span>
			<span className="share-label">{getButtonLabel()}</span>
		</button>
	);
};

export default ShareAction;
