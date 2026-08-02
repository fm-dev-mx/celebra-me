import { describe, expect, it, jest } from '@jest/globals';
import {
	parseTargets,
	verifyRequiredDatabaseAvailability,
	type DatabaseAvailabilityResult,
} from '../../scripts/db/verify-required-database-availability.ts';

function dependencies(input: {
	urls?: Partial<Record<'local' | 'preview' | 'production', string | null>>;
	classifications?: Partial<Record<string, string>>;
	probes?: Partial<Record<string, { status: number | null; stdout: string }>>;
}) {
	return {
		resolveUrl: (environment: 'local' | 'preview' | 'production') => {
			if (input.urls && Object.hasOwn(input.urls, environment)) {
				return input.urls[environment] ?? null;
			}
			return `${environment}-url`;
		},
		classify: (dbUrl: string) =>
			input.classifications?.[dbUrl] ??
			(dbUrl === 'local-url' ? 'persistent-local' : dbUrl.replace('-url', '')),
		probe: (dbUrl: string) => input.probes?.[dbUrl] ?? { status: 0, stdout: 'on\n' },
	};
}

function only(result: DatabaseAvailabilityResult[]): DatabaseAvailabilityResult {
	return result[0]!;
}

describe('required database availability preflight', () => {
	it('accepts comma- or PowerShell-normalized target lists', () => {
		expect(parseTargets(['--targets', 'local,preview,production'])).toEqual([
			'local',
			'preview',
			'production',
		]);
		expect(parseTargets(['--targets', 'local preview production'])).toEqual([
			'local',
			'preview',
			'production',
		]);
	});

	it('accepts only a reachable, correctly classified, read-only target', () => {
		expect(
			verifyRequiredDatabaseAvailability(['local', 'preview', 'production'], {
				dependencies: dependencies({}),
			}),
		).toEqual([
			{ environment: 'local', available: true },
			{ environment: 'preview', available: true },
			{ environment: 'production', available: true },
		]);
	});

	it('reports missing credentials without probing', () => {
		const probe = jest.fn(() => ({ status: 0, stdout: 'on\n' }));
		const result = only(
			verifyRequiredDatabaseAvailability(['preview'], {
				dependencies: { ...dependencies({ urls: { preview: null } }), probe },
			}),
		);
		expect(result).toEqual({
			environment: 'preview',
			available: false,
			reasonCode: 'CREDENTIALS_REQUIRED',
		});
		expect(probe).not.toHaveBeenCalled();
	});

	it.each([
		[
			'wrong identity',
			dependencies({ classifications: { 'production-url': 'preview' } }),
			'IDENTITY_CONFLICT',
		],
		[
			'unreachable target',
			dependencies({ probes: { 'production-url': { status: 1, stdout: '' } } }),
			'UNREACHABLE',
		],
		[
			'writable session',
			dependencies({ probes: { 'production-url': { status: 0, stdout: 'off\n' } } }),
			'READ_ONLY_ENFORCEMENT_FAILED',
		],
	] as const)('fails closed for a %s', (_label, deps, reasonCode) => {
		expect(
			only(
				verifyRequiredDatabaseAvailability(['production'], {
					dependencies: deps,
				}),
			),
		).toEqual({ environment: 'production', available: false, reasonCode });
	});
});
