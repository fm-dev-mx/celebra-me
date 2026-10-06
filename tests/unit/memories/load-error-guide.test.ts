import { MEMORIES_CONFIG_KEYS } from '@/lib/memories/contract/catalog';
import {
	describeMemoriesConfigGap,
	describeMemoriesLoadError,
	describeMemoriesWorkerUnreachable,
} from '@/lib/memories/dashboard-copy';

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

describe('describeMemoriesConfigGap', () => {
	it.each(MEMORIES_CONFIG_KEYS)(
		'says what %s disables, how to generate it and where it goes',
		(key) => {
			const guide = describeMemoriesConfigGap(key);
			const text = `${guide.title} ${guide.steps.join(' ')}`;

			expect(guide.title).toMatch(/^Falta/);
			expect(guide.steps.length).toBeGreaterThanOrEqual(2);
			expect(text).toMatch(/\.env\.local|\.dev\.vars|127\.0\.0\.1/);
			expect(text).toMatch(/Vercel|wrangler/);
			expect(text).not.toMatch(/(?:^|\s)(?:tú|tu)\s/i);
		},
	);

	it('points a missing share secret to a random generator and warns about live links', () => {
		const guide = describeMemoriesConfigGap('shareSecret');

		expect(guide.title).toContain('MEMORIES_SHARE_SECRET');
		expect(guide.steps.join(' ')).toContain('randomBytes(32)');
		expect(guide.steps.join(' ')).toContain('invalida todos los enlaces');
	});

	it('sends the public half of a signing pair to the matching Worker', () => {
		expect(describeMemoriesConfigGap('retrievalSigningKey').steps.join(' ')).toContain(
			'wrangler secret put MEMORIES_RETRIEVAL_REQUEST_VERIFY_PUBLIC_KEY',
		);
	});

	it('explains an unreachable Worker with its local script', () => {
		expect(describeMemoriesWorkerUnreachable('uploadOrigin').steps[0]).toContain(
			'pnpm worker:memories-sign:dev',
		);
	});
});
