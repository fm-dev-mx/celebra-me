import { SUPABASE_PROJECT_REFS } from '@/lib/intake/mutations/environment-identity';
import {
	resolveDashboardEnvBanner,
	type DashboardEnvBannerInput,
} from '@/lib/server/dashboard-env-banner';

const previewSupabase = `https://${SUPABASE_PROJECT_REFS.preview}.supabase.co`;
const localSupabase = 'http://127.0.0.1:54321';
const productionSupabase = `https://${SUPABASE_PROJECT_REFS.production}.supabase.co`;

function makeInput(overrides: Partial<DashboardEnvBannerInput> = {}): DashboardEnvBannerInput {
	return {
		vercelEnv: undefined,
		celebraRuntimeTarget: undefined,
		supabaseUrl: localSupabase,
		previewMfaBypass: undefined,
		...overrides,
	};
}

describe('resolveDashboardEnvBanner', () => {
	it('returns local banner for Local Supabase without VERCEL_ENV', () => {
		expect(resolveDashboardEnvBanner(makeInput())).toEqual({
			kind: 'local',
			className: 'dashboard-env-banner--local',
			label: '🧪 ENTORNO LOCAL',
		});
	});

	it('returns local banner when VERCEL_ENV=development', () => {
		expect(resolveDashboardEnvBanner(makeInput({ vercelEnv: 'development' }))).toMatchObject({
			kind: 'local',
		});
	});

	it('returns BD PREVIEW when local process targets Preview project', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					celebraRuntimeTarget: 'preview',
					supabaseUrl: previewSupabase,
				}),
			),
		).toEqual({
			kind: 'preview-db',
			className: 'dashboard-env-banner--preview',
			label: '🧪 BD PREVIEW',
		});
	});

	it('does not claim BD PREVIEW when target is preview but URL is not Preview project', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					celebraRuntimeTarget: 'preview',
					supabaseUrl: productionSupabase,
				}),
			),
		).toMatchObject({ kind: 'local' });
	});

	it('returns Vercel Preview banner without MFA note by default', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					vercelEnv: 'preview',
					supabaseUrl: previewSupabase,
				}),
			),
		).toEqual({
			kind: 'vercel-preview',
			className: 'dashboard-env-banner--preview',
			label: '⚠️ ENTORNO PREVIEW',
		});
	});

	it('appends MFA note when PREVIEW_MFA_BYPASS is active on Vercel Preview', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					vercelEnv: 'preview',
					previewMfaBypass: 'true',
					supabaseUrl: previewSupabase,
				}),
			),
		).toEqual({
			kind: 'vercel-preview',
			className: 'dashboard-env-banner--preview',
			label: '⚠️ ENTORNO PREVIEW — MFA desactivado',
		});
	});

	it('returns null on production', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					vercelEnv: 'production',
					supabaseUrl: productionSupabase,
				}),
			),
		).toBeNull();
	});

	it('does not treat CELEBRA_RUNTIME_TARGET as Preview when already on Vercel Preview', () => {
		expect(
			resolveDashboardEnvBanner(
				makeInput({
					vercelEnv: 'preview',
					celebraRuntimeTarget: 'preview',
					supabaseUrl: previewSupabase,
				}),
			),
		).toMatchObject({ kind: 'vercel-preview' });
	});
});
