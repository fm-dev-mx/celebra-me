import { Buffer } from 'node:buffer';

export const SUPABASE_PROJECT_REFS = {
	local: 'celebra-me-rsvp',
	preview: 'iwipdvisoyerfdytuhwi',
	production: 'ineitkdkyrxqyressllp',
} as const;

export type InvitationMutationEnvironment = keyof typeof SUPABASE_PROJECT_REFS;

export interface MutationEnvironmentIdentity {
	environment: InvitationMutationEnvironment;
	projectRef: string;
	apiUrl: string;
	storageUrl: string;
	credentialProjectRef: string;
	dbProjectRef?: string;
	runtimeEnvironment?: InvitationMutationEnvironment;
}

export function extractApiProjectRef(url: string): string {
	const parsed = new URL(url);
	if (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
		if (parsed.port !== '54321') throw new Error('Local Supabase API must use port 54321.');
		return SUPABASE_PROJECT_REFS.local;
	}
	if (parsed.protocol !== 'https:') throw new Error('Hosted Supabase API must use HTTPS.');
	const match = parsed.hostname.match(/^([^.]+)\.supabase\.(?:co|com)$/);
	if (!match?.[1]) throw new Error('Supabase API URL does not contain a supported project ref.');
	return match[1];
}

export function assertMutationEnvironmentIdentity(
	identity: MutationEnvironmentIdentity,
): MutationEnvironmentIdentity {
	const expectedRef = SUPABASE_PROJECT_REFS[identity.environment];
	if (identity.projectRef !== expectedRef) {
		throw new Error(
			`Environment identity mismatch: ${identity.environment} must use project ${expectedRef}.`,
		);
	}

	const apiRef = extractApiProjectRef(identity.apiUrl);
	if (apiRef !== expectedRef) {
		throw new Error('Supabase API URL belongs to a different environment.');
	}

	const storage = new URL(identity.storageUrl);
	const api = new URL(identity.apiUrl);
	if (storage.origin !== api.origin || !storage.pathname.startsWith('/storage/v1/')) {
		throw new Error('Storage endpoint does not belong to the verified Supabase API origin.');
	}

	if (identity.dbProjectRef !== undefined && identity.dbProjectRef !== expectedRef) {
		throw new Error('Database URL belongs to a different Supabase project.');
	}
	if (identity.credentialProjectRef !== expectedRef) {
		throw new Error('Supabase credential was not verified for the selected project.');
	}
	if (
		identity.runtimeEnvironment !== undefined &&
		identity.runtimeEnvironment !== identity.environment
	) {
		throw new Error('Runtime environment cannot mutate a different environment.');
	}

	return identity;
}

export function decodeJwtProjectRef(value: string): string | null {
	const parts = value.split('.');
	if (parts.length !== 3) return null;
	try {
		const normalized = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
		const payload = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as unknown;
		if (!payload || typeof payload !== 'object') return null;
		const ref = (payload as Record<string, unknown>).ref;
		return typeof ref === 'string' && ref.trim() ? ref.trim() : null;
	} catch {
		return null;
	}
}
