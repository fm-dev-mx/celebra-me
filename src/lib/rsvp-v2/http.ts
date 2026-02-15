export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

export function csvResponse(content: string, fileName: string): Response {
	return new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName}"`,
		},
	});
}

export function unauthorizedResponse(): Response {
	return jsonResponse({ message: 'No autorizado.' }, 401);
}

export function badRequest(message: string): Response {
	return jsonResponse({ message }, 400);
}

export function internalError(error: unknown): Response {
	const message = error instanceof Error ? error.message : 'Error interno del servidor.';
	return jsonResponse({ message }, 500);
}
