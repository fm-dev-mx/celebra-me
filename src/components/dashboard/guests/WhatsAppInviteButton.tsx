import React from 'react';

interface WhatsAppInviteButtonProps {
	waShareUrl: string;
	onShared: () => Promise<void> | void;
}

const WhatsAppInviteButton: React.FC<WhatsAppInviteButtonProps> = ({ waShareUrl, onShared }) => {
	const [status, setStatus] = React.useState<'idle' | 'sending' | 'delivered'>('idle');

	const handleClick = async () => {
		if (!waShareUrl) return;

		setStatus('sending');

		// Intelligent Social Sharing: use Web Share API if possible
		if (navigator.share) {
			try {
				await navigator.share({
					title: 'Invitación Celebra-me',
					text: '¡Hola! Te comparto tu invitación personalizada.',
					url: waShareUrl.split('text=')[1]
						? decodeURIComponent(waShareUrl.split('text=')[1].split('&')[0])
						: waShareUrl,
				});
				await onShared();
				setStatus('delivered');
				return;
			} catch (err) {
				console.info('Web Share aborted or failed:', err);
				// Fallback to WhatsApp link
			}
		}

		await onShared();
		setStatus('delivered');
		window.open(waShareUrl, '_blank', 'noopener,noreferrer');
	};

	return (
		<button
			type="button"
			className={`dashboard-guests__wa-button dashboard-guests__wa-button--${status}`}
			onClick={handleClick}
			disabled={status !== 'idle'}
			title="Enviar por WhatsApp"
		>
			<span className="wa-icon">{status === 'delivered' ? '✅' : '📱'}</span>{' '}
			{status === 'idle' ? 'Enviar' : status === 'sending' ? 'Enviando...' : 'Enviado'}
		</button>
	);
};

export default WhatsAppInviteButton;
