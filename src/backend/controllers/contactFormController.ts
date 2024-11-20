// src/backend/controllers/contactFormController.ts

import { EmailService } from '@/backend/services/emailService';
import { ContactFormRepository } from '@/backend/repositories/contactFormRepository';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';
import logger from '../utilities/logger';
import { jsonResponse } from '@/core/config/constants';

/**
 * Controlador para manejar solicitudes del formulario de contacto.
 */
export class ContactFormController {
	private emailService: EmailService;
	private contactFormRepository: ContactFormRepository;

	constructor(emailService: EmailService, contactFormRepository: ContactFormRepository) {
		this.emailService = emailService;
		this.contactFormRepository = contactFormRepository;
	}

	/**
	 * Maneja el procesamiento de una solicitud del formulario de contacto.
	 * @param contactFormData - Datos recibidos del formulario de contacto.
	 */
	async sendEmail(context: ContactFormAPIContext): Promise<Response> {

		if (context.validatedData) {
			// Guardar los datos en la base de datos
			await this.contactFormRepository.saveSubmission(context.validatedData);

		}

		// Preparar los datos del correo electrónico
		const emailData: EmailData = {
			to: config.emailConfig.recipient,
			from: config.emailConfig.sender,
			replyTo: context.validatedData!.email,
			subject: `Nuevo mensaje de ${context.validatedData!.name} desde el formulario de contacto`,
			html: `<p><strong>Nombre:</strong> ${context.validatedData!.name}</p>
                    <p><strong>Email:</strong> ${context.validatedData!.email}</p>
                    <p><strong>Teléfono:</strong> ${context.validatedData!.mobile}</p>
                    <p><strong>Mensaje:</strong> ${context.validatedData!.message}</p>`,
		};

		// Enviar el correo electrónico
		try {
			await this.emailService.sendEmail(emailData);
			return jsonResponse({ success: true, message: 'Hemos recibido tu mensaje, te respondemos muy pronto.' }, 200);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Error sending email', {
				error: errorMessage,
				stack: error instanceof Error ? error.stack : undefined,
			});
			return jsonResponse({ success: false, message: 'Error al enviar el correo.' }, 500);
		}
	}
}
