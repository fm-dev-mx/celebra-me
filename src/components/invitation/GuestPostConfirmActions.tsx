import React from 'react';

interface GuestPostConfirmActionsProps {
	eventTitle: string;
	startIso?: string;
	endIso?: string;
	hostWhatsAppPhone?: string;
	guestName: string;
	attendanceStatus: 'confirmed' | 'declined';
}

function buildGoogleCalendarLink(input: {
	eventTitle: string;
	startIso?: string;
	endIso?: string;
}): string {
	const title = encodeURIComponent(input.eventTitle);
	const start = input.startIso
		? new Date(input.startIso)
				.toISOString()
				.replace(/[-:]/g, '')
				.replace(/\.\d{3}Z$/, 'Z')
		: '';
	const end = input.endIso
		? new Date(input.endIso)
				.toISOString()
				.replace(/[-:]/g, '')
				.replace(/\.\d{3}Z$/, 'Z')
		: '';
	return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`;
}

const GuestPostConfirmActions: React.FC<GuestPostConfirmActionsProps> = ({
	eventTitle,
	startIso,
	endIso,
	hostWhatsAppPhone,
	guestName,
	attendanceStatus,
}) => {
	const calendarLink = buildGoogleCalendarLink({ eventTitle, startIso, endIso });
	const phone = (hostWhatsAppPhone || '').replace(/[^\d]/g, '');
	const message = `Hola, soy ${guestName}. Mi respuesta es: ${attendanceStatus}.`;
	const whatsappLink = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';

	return (
		<div className="guest-post-confirm-actions">
			<a href={calendarLink} target="_blank" rel="noopener noreferrer">
				Agregar al calendario
			</a>
			{whatsappLink && (
				<a href={whatsappLink} target="_blank" rel="noopener noreferrer">
					Enviar confirmacion por WhatsApp
				</a>
			)}
		</div>
	);
};

export default GuestPostConfirmActions;
