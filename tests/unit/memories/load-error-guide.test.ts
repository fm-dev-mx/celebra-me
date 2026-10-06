import { describeMemoriesLoadError } from '@/lib/memories/dashboard-copy';

describe('describeMemoriesLoadError', () => {
	it('points schema drift to the migration commands', () => {
		const guide = describeMemoriesLoadError({ status: 503, code: 'schema_out_of_date' });

		expect(guide.title).toContain('migraciones');
		expect(guide.steps.join(' ')).toContain('pnpm db:migrate -- --target local');
	});

	it.each([
		[{ status: 401, code: 'unauthorized' }, 'sesión expiró'],
		[{ status: 403, code: 'forbidden' }, 'superadministrador'],
		[{ status: null, code: 'forbidden' }, 'superadministrador'],
		[{ status: 429, code: 'rate_limited' }, 'demasiadas consultas'],
		[{ status: 408, code: 'timeout' }, 'tardó demasiado'],
		[{ status: 503, code: 'service_unavailable' }, 'servicio externo'],
		[{ status: 502, code: 'upstream_error' }, 'autenticación'],
	])('names the cause for %o', (failure, expected) => {
		expect(describeMemoriesLoadError(failure).title).toContain(expected);
	});

	it('falls back to server-log guidance for unknown failures', () => {
		const guide = describeMemoriesLoadError({ status: 500, code: 'internal_error' });

		expect(guide.steps.join(' ')).toContain('[rsvp]');
		expect(describeMemoriesLoadError({ status: null }).title).toBe(guide.title);
	});
});
