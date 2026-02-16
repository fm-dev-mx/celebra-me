export const EVENT_SLUG = 'gerardo-sesenta';
export const TOKEN_SECRET = 'test-rsvp-secret';
export const ADMIN_USER = 'admin';
export const ADMIN_PASSWORD = 'admin-pass';

export function buildBasicAuthHeader(user = ADMIN_USER, password = ADMIN_PASSWORD): string {
	return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

export function getMockEvents() {
	return [
		{
			id: EVENT_SLUG,
			data: {
				eventType: 'cumple',
				rsvp: {
					guestCap: 5,
					whatsappConfig: {
						phone: '5216681167477',
						messageTemplate: 'Hola {name}, te comparto tu invitación: {inviteUrl}',
					},
					guests: [
						{
							guestId: 'fam-mendoza-001',
							displayName: 'Viridiana Mendoza',
							maxAllowedAttendees: 4,
						},
					],
				},
			},
		},
	];
}

export function createMockRequest(
	payload?: unknown,
	headers?: Record<string, string>,
): Pick<Request, 'json' | 'text' | 'headers'> {
	const defaultHeaders: Record<string, string> = {};

	// Only add Content-Type if not explicitly overridden or removed
	if (headers && 'Content-Type' in headers) {
		if (headers['Content-Type'] !== '') {
			defaultHeaders['Content-Type'] = headers['Content-Type'];
		}
	} else {
		defaultHeaders['Content-Type'] = 'application/json';
	}

	// Add other headers
	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			if (key !== 'Content-Type' || value !== '') {
				defaultHeaders[key] = value;
			}
		}
	}

	return {
		json: async () => payload,
		text: async () => {
			if (payload === undefined || payload === null) {
				return '';
			}
			if (typeof payload === 'string') {
				return payload;
			}
			return JSON.stringify(payload);
		},
		headers: {
			get: (name: string) => {
				const key = Object.keys(defaultHeaders).find(
					(headerName) => headerName.toLowerCase() === name.toLowerCase(),
				);
				return key ? (defaultHeaders[key] ?? null) : null;
			},
		} as Headers,
	};
}
