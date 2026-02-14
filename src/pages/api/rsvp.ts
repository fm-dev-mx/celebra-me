import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
	try {
		const data = await request.json();
		const { name, attendance } = data;
		// Optional fields (e.g. dietary) may be omitted by design.

		// Validation
		if (!name || !attendance) {
			return new Response(
				JSON.stringify({
					message: 'Faltan campos obligatorios.',
				}),
				{ status: 400 },
			);
		}

		// In a real scenario, this would save to a database (Astro DB, Supabase, etc.)
		// For now, we simulate a successful submission
		await new Promise((resolve) => setTimeout(resolve, 1000));

		return new Response(
			JSON.stringify({
				message: '¡Confirmación recibida con éxito!',
			}),
			{ status: 200 },
		);
	} catch (error) {
		console.error('RSVP API Error:', error);
		return new Response(
			JSON.stringify({
				message: 'Error interno del servidor.',
			}),
			{ status: 500 },
		);
	}
};
