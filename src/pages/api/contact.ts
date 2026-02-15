import type { APIRoute } from 'astro';
import { z } from 'zod';
import { sendEmail } from '@/utils/email';
import { successResponse, errorResponse, validateBody } from '@/utils/api-utils';

const contactSchema = z.object({
	name: z.string().min(6, 'El nombre es obligatorio'),
	email: z.string().email('El formato del correo electrónico no es válido'),
	message: z.string().min(10, 'El mensaje es obligatorio'),
});

export const POST: APIRoute = async ({ request }) => {
	try {
		const { name, email, message } = await validateBody(request, contactSchema);

		// Process email sending
		const success = await sendEmail({
			name,
			email,
			message,
			type: 'contact',
		});

		if (success) {
			return successResponse({ message: 'Mensaje enviado con éxito' });
		} else {
			return errorResponse('Error al enviar el correo', { status: 500 });
		}
	} catch (error) {
		console.error('API Error:', error);
		if (error instanceof Error && error.message.includes('Validación fallida')) {
			return errorResponse(error.message, { status: 400, error });
		}
		return errorResponse('Error interno del servidor', { error });
	}
};
