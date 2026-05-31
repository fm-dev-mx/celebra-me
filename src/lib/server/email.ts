import nodemailer from 'nodemailer';
import { getEnv } from '@/lib/server/env';

export interface EmailPayload {
	name: string;
	email: string;
	phone?: string;
	message: string;
	type?: 'contact' | 'rsvp';
}

const EMAIL_COLORS = {
	accent: '#c5a059',
	text: '#333333',
	border: '#eeeeee',
	background: '#fdfcfb',
	muted: '#999999',
} as const;

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
			<div style="font-family: sans-serif; color: ${EMAIL_COLORS.text}; max-width: 600px; border: 1px solid ${EMAIL_COLORS.border}; padding: 20px; border-radius: 8px;">
				<h2 style="color: ${EMAIL_COLORS.accent}; border-bottom: 2px solid ${EMAIL_COLORS.background}; padding-bottom: 10px;">Nueva Solicitud Concierge</h2>
				<p><strong>De:</strong> ${data.name} (${data.email})</p>
				<p><strong>Teléfono:</strong> ${data.phone || 'N/A'}</p>
				<p><strong>Tipo de Evento:</strong> ${data.type || 'General'}</p>
				<div style="background: ${EMAIL_COLORS.background}; padding: 15px; border-radius: 4px; border-left: 4px solid ${EMAIL_COLORS.accent}; margin: 20px 0;">
					<p style="margin: 0; font-style: italic;">"${data.message}"</p>
				</div>
				<hr style="border: 0; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 20px 0;" />
				<p style="font-size: 12px; color: ${EMAIL_COLORS.muted};">Esta es una notificación automática de Celebra-me.com</p>
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

export interface IntakeNotificationPayload {
	invitationTitle: string;
	clientName: string;
	reviewUrl: string;
}

export const sendIntakeNotification = async (
	payload: IntakeNotificationPayload,
): Promise<boolean> => {
	const user = (getEnv('GMAIL_USER') || '').trim();
	const pass = (getEnv('GMAIL_PASS') || '').trim();

	if (!user || !pass) {
		console.error('Missing GMAIL_USER or GMAIL_PASS environment variables');
		return false;
	}

	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: { user, pass },
	});

	const recipient = getEnv('CONTACT_FORM_RECIPIENT_EMAIL') || user;

	const mailOptions = {
		from: `"Celebra-me Intake" <${user}>`,
		to: recipient,
		subject: `Nueva captura recibida: ${payload.invitationTitle}`,
		text: `
			Se ha recibido una nueva captura de intake.

			Invitación: ${payload.invitationTitle}
			Cliente: ${payload.clientName}

			Revisar captura:
			${payload.reviewUrl}

			---
			Notificacion automatica de Celebra-me Intake
		`,
		html: `
			<div style="font-family: sans-serif; color: ${EMAIL_COLORS.text}; max-width: 600px; border: 1px solid ${EMAIL_COLORS.border}; padding: 20px; border-radius: 8px;">
				<h2 style="color: ${EMAIL_COLORS.accent}; border-bottom: 2px solid ${EMAIL_COLORS.background}; padding-bottom: 10px;">Nueva Captura Recibida</h2>
				<p><strong>Invitación:</strong> ${payload.invitationTitle}</p>
				<p><strong>Cliente:</strong> ${payload.clientName}</p>
				<div style="background: ${EMAIL_COLORS.background}; padding: 15px; border-radius: 4px; border-left: 4px solid ${EMAIL_COLORS.accent}; margin: 20px 0;">
					<a href="${payload.reviewUrl}" style="color: ${EMAIL_COLORS.accent}; font-weight: bold;">Revisar captura en el panel</a>
				</div>
				<hr style="border: 0; border-top: 1px solid ${EMAIL_COLORS.border}; margin: 20px 0;" />
				<p style="font-size: 12px; color: ${EMAIL_COLORS.muted};">Notificacion automatica de Celebra-me Intake</p>
			</div>
		`,
	};

	try {
		await transporter.sendMail(mailOptions);
		return true;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[intake] Email notification failed:', errorMessage);
		return false;
	}
};
