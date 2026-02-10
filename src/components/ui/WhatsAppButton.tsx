import React from 'react';
import { WhatsAppIcon } from '@/components/common/icons/social';

interface WhatsAppButtonProps {
	className?: string;
	phone?: string;
	message?: string;
	label?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
	className = '',
	phone = '5215500000000', // Placeholder, should come from config
	message = '¡Hola! Me gustaría recibir información sobre las invitaciones digitales premium.',
	label = 'Crea tu Invitación',
}) => {
	const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

	return (
		<a
			href={whatsappUrl}
			target="_blank"
			rel="noopener noreferrer"
			className={`whatsapp-button ${className}`}
			aria-label="Contactar por WhatsApp"
		>
			<WhatsAppIcon size={20} />
			{label}
		</a>
	);
};

export default WhatsAppButton;
