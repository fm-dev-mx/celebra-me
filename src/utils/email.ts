import nodemailer from 'nodemailer';
import { getEnv } from './env';

export interface EmailPayload {
	name: string;
	email: string;
	phone?: string;
	message: string;
	type?: 'contact' | 'rsvp';
}

/**
 * Send email using Gmail (Nodemailer)
 */
export const sendEmail = async (data: EmailPayload): Promise<boolean> => {
	const user = (getEnv('GMAIL_USER') || '').trim();
	const pass = (getEnv('GMAIL_PASS') || '').trim();

	if (!user || !pass) {
		console.error('Missing GMAIL_USER or GMAIL_PASS environment variables');
		return false;
	}

	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true, // Use SSL
		auth: {
			user,
			pass,
		},
	});

	const recipient = getEnv('CONTACT_FORM_RECIPIENT_EMAIL') || user;

	const mailOptions = {
		from: `"Celebra-me Concierge" <${user}>`,
		to: recipient,
		replyTo: data.email,
		subject: `✨ Nueva Solicitud: ${data.name} - ${data.type || 'Contacto'}`,
		text: `
			Nueva solicitud desde Celebra-me.com:

			Nombre: ${data.name}
			Correo: ${data.email}
			Teléfono: ${data.phone || 'N/A'}
			Tipo: ${data.type || 'General'}

			Mensaje:
			${data.message}

			---
			Enviado desde el sistema Concierge de Celebra-me
		`,
		html: `
			<div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
				<h2 style="color: #c5a059; border-bottom: 2px solid #fdfcfb; padding-bottom: 10px;">Nueva Solicitud Concierge</h2>
				<p><strong>De:</strong> ${data.name} (${data.email})</p>
				<p><strong>Teléfono:</strong> ${data.phone || 'N/A'}</p>
				<p><strong>Tipo de Evento:</strong> ${data.type || 'General'}</p>
				<div style="background: #fdfcfb; padding: 15px; border-radius: 4px; border-left: 4px solid #c5a059; margin: 20px 0;">
					<p style="margin: 0; font-style: italic;">"${data.message}"</p>
				</div>
				<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
				<p style="font-size: 12px; color: #999;">Esta es una notificación automática de Celebra-me.com</p>
			</div>
		`,
	};

	try {
		await transporter.sendMail(mailOptions);
		return true;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Gmail send failed:', errorMessage);
		return false;
	}
};
