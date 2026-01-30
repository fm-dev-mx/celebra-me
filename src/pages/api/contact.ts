import type { APIRoute } from 'astro';
import { sendEmail } from '@/utils/email';

export const POST: APIRoute = async ({ request }) => {
	try {
		const data = await request.json();
		const { name, email, message } = data;

		// Validation
		if (!name || !email || !message) {
			return new Response(
				JSON.stringify({ message: 'Todos los campos son obligatorios' }),
				{ status: 400 }
			);
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return new Response(
				JSON.stringify({ message: 'El formato del correo electrónico no es válido' }),
				{ status: 400 }
			);
		}

		// Process email sending
		const success = await sendEmail({
			name,
			email,
			message,
			type: 'contact'
		});

		if (success) {
			return new Response(
				JSON.stringify({ message: 'Mensaje enviado con éxito' }),
				{ status: 200 }
			);
		} else {
			return new Response(
				JSON.stringify({ message: 'Error al enviar el correo' }),
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('API Error:', error);
		return new Response(
			JSON.stringify({ message: 'Error interno del servidor' }),
			{ status: 500 }
		);
	}
};
