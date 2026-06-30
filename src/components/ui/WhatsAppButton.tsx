import React from 'react';
import { WhatsAppIcon } from '@/components/common/icons/social';
import { getWhatsAppLink, isPlaceholderContactPhone } from '@/utils/whatsapp';

interface WhatsAppButtonProps {
	className?: string;
	phone?: string;
	message?: string;
	label?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
	className = '',
	phone: explicitPhone,
	message = '¡Hola! Me gustaría recibir información sobre las invitaciones digitales premium.',
	label = 'Solicitar asesoría',
}) => {
	const phone = explicitPhone || '';
	const isPlaceholder = phone ? isPlaceholderContactPhone(phone) : true;
	const whatsappUrl = isPlaceholder ? '' : getWhatsAppLink(message);

	if (isPlaceholder) return null;

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
