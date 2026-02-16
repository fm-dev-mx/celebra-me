import React from 'react';

interface WhatsAppInviteButtonProps {
	waShareUrl: string;
	onShared: () => Promise<void> | void;
}

const WhatsAppInviteButton: React.FC<WhatsAppInviteButtonProps> = ({ waShareUrl, onShared }) => {
	const handleClick = async () => {
		if (!waShareUrl) return;

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
				return;
			} catch (err) {
				console.info('Web Share aborted or failed:', err);
				// Fallback to WhatsApp link
			}
		}

		await onShared();
		window.open(waShareUrl, '_blank', 'noopener,noreferrer');
	};

	return (
		<button
			type="button"
			className="dashboard-guests__wa-button"
			onClick={handleClick}
			title="Enviar por WhatsApp"
		>
			<span className="wa-icon">📱</span> Enviar
		</button>
	);
};

export default WhatsAppInviteButton;
