import type { APIRoute } from 'astro';
import { jsonResponse } from '@/lib/rsvp/http';

export const GET: APIRoute = async () => {
	const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> =
		{};

	const startDb = Date.now();
	try {
		const { createClient } = await import('@supabase/supabase-js');
		const supabase = createClient(
			import.meta.env.PUBLIC_SUPABASE_URL,
			import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
		);
		const { error } = await supabase.from('events').select('id').limit(1);
		checks.database = {
			status: error && error.code !== 'PGRST116' ? 'error' : 'ok',
			latencyMs: Date.now() - startDb,
			error: error?.message,
		};
	} catch (e) {
		checks.database = {
			status: 'error',
			latencyMs: Date.now() - startDb,
			error: e instanceof Error ? e.message : 'Unknown error',
		};
	}

	const allOk = Object.values(checks).every((c) => c.status === 'ok');

	return jsonResponse(
		{
			status: allOk ? 'healthy' : 'degraded',
			timestamp: new Date().toISOString(),
			version: '1.0.0',
			checks,
		},
		allOk ? 200 : 503,
	);
};
