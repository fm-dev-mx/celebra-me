function isProduction(): boolean {
	return process.env.NODE_ENV === 'production';
}

export function buildSessionCookie(accessToken: string): string {
	const parts = [
		`sb-access-token=${encodeURIComponent(accessToken)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
	];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}

export function clearSessionCookie(): string {
	const parts = ['sb-access-token=', 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
	if (isProduction()) parts.push('Secure');
	return parts.join('; ');
}
