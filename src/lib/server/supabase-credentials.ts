import { getEnv } from '@/lib/server/env';

export function getSupabaseUrl(): string {
	const value = getEnv('SUPABASE_URL');
	if (!value) throw new Error('SUPABASE_URL no configurada.');
	return value.replace(/\/+$/, '');
}

export function getSupabaseAnonKey(): string {
	const value = getEnv('SUPABASE_ANON_KEY');
	if (!value) throw new Error('SUPABASE_ANON_KEY no configurada.');
	return value;
}

export function getSupabaseServiceRoleKey(): string {
	const value = getEnv('SUPABASE_SERVICE_ROLE_KEY');
	if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
	return value;
}
