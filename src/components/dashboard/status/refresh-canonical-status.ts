import { dashboardApi } from '@/lib/dashboard/api-client';
import type { CanonicalStatusView, TargetEnv } from '@/lib/status/types';

const CANONICAL_STATUS_REFRESH_TIMEOUT_MS = 130_000;

export async function refreshCanonicalStatusTwoWave(input: {
	envFilter: 'all' | TargetEnv;
	domainFilter: 'all' | 'schema' | 'content' | 'patch';
	includeDiagnostics: boolean;
}): Promise<{ view: CanonicalStatusView | null; error: string | null }> {
	const params = new URLSearchParams({ refresh: '1' });
	if (input.envFilter !== 'all') params.set('env', input.envFilter);
	if (input.domainFilter !== 'all') params.set('domain', input.domainFilter);
	if (input.includeDiagnostics) params.set('diagnostics', '1');
	const result = await dashboardApi.get<CanonicalStatusView>(
		`/api/dashboard/estado?${params.toString()}`,
		{ timeoutMs: CANONICAL_STATUS_REFRESH_TIMEOUT_MS },
	);
	if (!result.ok) {
		return { view: null, error: result.message || 'No se pudo actualizar el estado.' };
	}
	if (input.domainFilter !== 'all' && input.domainFilter !== 'content') {
		return { view: result.data, error: null };
	}
	const preflightParams = new URLSearchParams(params);
	preflightParams.set('preflight', '1');
	const refined = await dashboardApi.get<CanonicalStatusView>(
		`/api/dashboard/estado?${preflightParams.toString()}`,
		{ timeoutMs: CANONICAL_STATUS_REFRESH_TIMEOUT_MS },
	);
	if (!refined.ok) {
		return {
			view: result.data,
			error: refined.message || 'No se pudo completar el preflight de Production.',
		};
	}
	return { view: refined.data, error: null };
}
