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
				rsvp: {
					guestCap: 5,
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
): Pick<Request, 'json' | 'headers'> {
	return {
		json: async () => payload,
		headers: {
			get: (name: string) => {
				const key = Object.keys(headers ?? {}).find(
					(headerName) => headerName.toLowerCase() === name.toLowerCase(),
				);
				return key ? (headers?.[key] ?? null) : null;
			},
		} as Headers,
	};
}
