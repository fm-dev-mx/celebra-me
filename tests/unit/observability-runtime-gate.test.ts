import { beforeEach, describe, expect, it } from '@jest/globals';
import {
	isLocalObservabilityRuntime,
	type ObservabilityRuntimeEnv,
} from '@/lib/observability/runtime-gate';
import { asHostedDeploy, asLocalDevServer } from '@tests/helpers/deploy-identity';

const localBase: ObservabilityRuntimeEnv = {
	supabaseUrl: 'http://127.0.0.1:54321',
	celebraRuntimeTarget: 'local',
};

describe('isLocalObservabilityRuntime', () => {
	beforeEach(asLocalDevServer);

	it('allows persistent-Local runtime', () => {
		expect(isLocalObservabilityRuntime(localBase)).toBe(true);
		expect(
			isLocalObservabilityRuntime({
				...localBase,
				celebraRuntimeTarget: '',
				supabaseUrl: 'http://localhost:54321',
			}),
		).toBe(true);
	});

	it.each(['preview', 'production', 'staging'])(
		'rejects a declared deploy identity (%s)',
		(environment) => {
			asHostedDeploy(environment);
			expect(isLocalObservabilityRuntime(localBase)).toBe(false);
		},
	);

	it('rejects https on the Local Supabase port', () => {
		expect(
			isLocalObservabilityRuntime({ ...localBase, supabaseUrl: 'https://127.0.0.1:54321' }),
		).toBe(false);
	});

	it('rejects Preview runtime target', () => {
		expect(
			isLocalObservabilityRuntime({
				...localBase,
				celebraRuntimeTarget: 'preview',
				supabaseUrl: 'https://iwipdvisoyerfdytuhwi.supabase.co',
			}),
		).toBe(false);
	});

	it('rejects missing or non-local Supabase URL', () => {
		expect(isLocalObservabilityRuntime({ ...localBase, supabaseUrl: undefined })).toBe(false);
		expect(
			isLocalObservabilityRuntime({
				...localBase,
				supabaseUrl: 'https://ineitkdkyrxqyressllp.supabase.co',
			}),
		).toBe(false);
	});
});
