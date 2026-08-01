import { describe, expect, it } from '@jest/globals';
import {
	isLocalObservabilityRuntime,
	type ObservabilityRuntimeEnv,
} from '@/lib/observability/runtime-gate';

const localBase: ObservabilityRuntimeEnv = {
	vercel: undefined,
	vercelEnv: undefined,
	nodeEnv: 'development',
	supabaseUrl: 'http://127.0.0.1:54321',
	celebraRuntimeTarget: 'local',
};

describe('isLocalObservabilityRuntime', () => {
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

	it('rejects Vercel hosted environments', () => {
		expect(isLocalObservabilityRuntime({ ...localBase, vercel: '1' })).toBe(false);
		expect(isLocalObservabilityRuntime({ ...localBase, vercelEnv: 'preview' })).toBe(false);
		expect(isLocalObservabilityRuntime({ ...localBase, vercelEnv: 'production' })).toBe(false);
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
