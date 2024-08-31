import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

/**
 * Serverless function that handles incoming POST requests
 * and sends an email using the provided form data.
 *
 * @param request - The incoming HTTP request object from Astro
 * @returns {Response} A JSON response indicating success or failure.
 */
export async function POST({ request }: { request: Request }) {
	try {
		// Leer el cuerpo de la solicitud para obtener los datos enviados por el formulario.
		const { name, email, message } = await request.json();

		// Verificar que los campos requeridos no estén vacíos.
		if (!name || !email || !message) {
			return new Response(JSON.stringify({ error: 'All fields are required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Configurar el transportador de correo utilizando nodemailer para Zoho Mail.
		const transporter = nodemailer.createTransport({
			host: 'smtp.zoho.com',
			port: 465,
			secure: true,
			auth: {
				user: import.meta.env.ZOHO_USER,
				pass: import.meta.env.ZOHO_PASS,
			},
		});

		// Definir las opciones del correo, incluyendo el remitente, destinatario, asunto y cuerpo del mensaje.
		const mailOptions = {
			from: import.meta.env.ZOHO_USER, // Tu correo de Zoho
			replyTo: email, // Permitir al destinatario responder al remitente del formulario
			to: import.meta.env.RECIPIENT_EMAIL, // El destinatario del correo (tu correo)
			subject: `Nuevo mensaje de ${name}`, // Asunto del correo
			text: `Nombre: ${name}\nEmail: ${email}\nMensaje: ${message}`, // Cuerpo del correo con los datos del formulario
		};

		// Enviar el correo
		await transporter.sendMail(mailOptions);

		// Responder con éxito
		return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		// Log del error para depuración y respuesta de fallo
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: 'Failed to send email' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
