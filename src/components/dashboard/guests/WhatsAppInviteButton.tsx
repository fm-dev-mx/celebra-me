import React from 'react';

interface WhatsAppInviteButtonProps {
	waShareUrl: string;
	onShared: () => Promise<void> | void;
}

const WhatsAppInviteButton: React.FC<WhatsAppInviteButtonProps> = ({ waShareUrl, onShared }) => {
	const handleClick = async () => {
		if (!waShareUrl) return;
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
