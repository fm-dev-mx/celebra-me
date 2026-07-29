export const HOST_LOGIN_DOMAIN = 'clientes.celebra.invalid';
export const HOST_LOGIN_ALIAS_MIN_LENGTH = 3;
export const HOST_LOGIN_ALIAS_MAX_LENGTH = 60;
export const HOST_LOGIN_ALIAS_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function normalizeHostLoginAlias(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, HOST_LOGIN_ALIAS_MAX_LENGTH);
}

export function isCanonicalHostLoginAlias(value: string): boolean {
	return (
		value.length >= HOST_LOGIN_ALIAS_MIN_LENGTH &&
		value.length <= HOST_LOGIN_ALIAS_MAX_LENGTH &&
		!value.includes('@') &&
		HOST_LOGIN_ALIAS_PATTERN.test(value)
	);
}

export function isValidHostLoginAliasInput(value: unknown): boolean {
	if (typeof value !== 'string' || value.includes('@')) return false;
	return isCanonicalHostLoginAlias(normalizeHostLoginAlias(value));
}

export function parseHostLoginAlias(value: unknown): string {
	const normalized = normalizeHostLoginAlias(value);
	if (!isCanonicalHostLoginAlias(normalized)) {
		throw new Error('Invalid managed host login alias.');
	}
	return normalized;
}

export function buildManagedHostEmail(alias: unknown): string {
	return `${parseHostLoginAlias(alias)}@${HOST_LOGIN_DOMAIN}`;
}

export function isManagedHostEmail(value: unknown): boolean {
	return (
		typeof value === 'string' &&
		value.trim().toLowerCase().endsWith(`@${HOST_LOGIN_DOMAIN}`)
	);
}
