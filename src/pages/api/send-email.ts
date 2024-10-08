// send-email.ts
import type { APIRoute } from 'astro'; // Importa APIRoute desde Astro
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import type { APIContext } from 'astro';

// Load environment variables from the .env file
dotenv.config();

// Simple in-memory store for rate limiting
const rateLimit = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 3; // Limit each IP to 5 requests per windowMs

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const windowStart = now - WINDOW_MS;

	if (!rateLimit.has(ip)) {
		rateLimit.set(ip, [now]);
		return false;
	}

	const requests = rateLimit.get(ip).filter((time: number) => time > windowStart);
	requests.push(now);
	rateLimit.set(ip, requests);

	return requests.length > MAX_REQUESTS;
}

/**
 * Serverless function that handles incoming POST requests
 * and sends an email using the provided form data.
 *
 * @param request - The incoming HTTP request object from Astro
 * @returns {Response} A JSON response indicating success or failure.
 */
export const POST: APIRoute = async ({ request }: APIContext) => { // Define la ruta como APIRoute
	// console.log('Environment Variables:', process.env.ZOHO_USER, process.env.ZOHO_PASS ? 'Loaded' : 'Not Loaded');

	try {
		const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

		if (isRateLimited(clientIP)) {
			console.log(`Rate limit exceeded for IP: ${clientIP}`);
			return new Response(JSON.stringify({ error: 'Too many requests, please try again later.' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Check if the Content-Type of the request is JSON
		const contentType = request.headers.get('Content-Type');
		console.log('Received Content-Type:', contentType); // Log the content type received

		if (contentType !== 'application/json') {
			console.error('Invalid Content-Type:', contentType);
			return new Response(
				JSON.stringify({ error: 'Invalid Content-Type' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Read the request body as text for manual parsing
		const requestBody = await request.text();
		console.log('Received request body:', requestBody); // Log the raw request body
		let parsedData;

		try {
			// Attempt to parse the request body as JSON
			parsedData = JSON.parse(requestBody);
			console.log('Parsed data:', parsedData); // Log the parsed data
		} catch (parseError) {
			console.error('Error parsing JSON:', parseError);
			return new Response(
				JSON.stringify({ error: 'Invalid JSON format' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Destructure the parsed data to extract form fields
		const { name, email, mobile, message } = parsedData;
		console.log('Form data:', { name, email, mobile, message }); // Log the form data

		// Check if required fields are missing
		if (!name || !email || !mobile || !message) {
			console.log('Missing fields:', { name, email, mobile, message }); // Log missing fields
			return new Response(
				JSON.stringify({ error: 'All fields are required.' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Configure the mail transporter using Nodemailer with Zoho Mail settings
		const transporter = nodemailer.createTransport({
			host: 'smtp.zoho.com', // Zoho SMTP server
			port: 465, // Port for secure connections
			secure: true, // Use SSL/TLS
			auth: {
				user: import.meta.env.ZOHO_USER, // Zoho user email from environment variables
				pass: import.meta.env.ZOHO_PASS, // Zoho user password from environment variables
			},
		});

		// Define the email options including sender, recipient, subject, and body
		const mailOptions = {
			from: import.meta.env.ZOHO_USER, // Sender's email address (Zoho)
			replyTo: email, // Set reply-to as the user's email from the form
			to: import.meta.env.RECIPIENT_EMAIL, // Recipient's email address (your email)
			subject: `Nuevo mensaje de ${name} via Celebra-me`, // Email subject with the sender's name
			text: `Nombre: ${name}\n\nEmail: ${email}\n\nCelular: ${mobile}\n\nMensaje: ${message}`, // Email body containing the form data
		};
		console.log('Mail options:', mailOptions); // Log the email options

		// Send the email using the transporter
		await transporter.sendMail(mailOptions);
		console.log('Email sent successfully'); // Log successful email sending

		// Return a success response after the email is sent
		return new Response(
			JSON.stringify({ message: 'Email sent successfully' }),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	} catch (error: any) {
		// Log any unexpected errors and return a failure response
		console.error('Error:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to send e-mail!!', details: error.message }), // Include error details in response
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
};

// Opt-out of pre-rendering for this serverless function
export const prerender = false;
