import {
	isMissingEngagementColumnError,
	resetGuestSchemaCompatForTests,
	stripEngagementWriteFields,
	withGuestColumns,
} from '@/lib/rsvp/repositories/shared/guest-schema-compat';
import { GUEST_BASE_COLUMNS, GUEST_COLUMNS } from '@/lib/rsvp/repositories/shared/rows';
import {
	recordGuestEngagementEventsRpc,
	resetEngagementLedgerGuardForTests,
} from '@/lib/rsvp/repositories/engagement.repository';
import { SupabaseHttpError, supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

jest.mock('@/lib/rsvp/repositories/supabase', () => {
	const actual = jest.requireActual('@/lib/rsvp/repositories/supabase');
	return { ...actual, supabaseRestRequest: jest.fn() };
});

const restMock = supabaseRestRequest as jest.MockedFunction<typeof supabaseRestRequest>;

const missingSelect = new SupabaseHttpError(
	400,
	'{"code":"42703","message":"column guest_invitations.is_test does not exist"}',
	'42703',
);
const missingWrite = new SupabaseHttpError(
	400,
	`{"code":"PGRST204","message":"Could not find the 'is_test' column of 'guest_invitations' in the schema cache"}`,
	'PGRST204',
);
const otherMissing = new SupabaseHttpError(
	400,
	'{"code":"42703","message":"column guest_invitations.nickname does not exist"}',
	'42703',
);

describe('guest engagement column compatibility', () => {
	let clock = 1_000_000;
	const now = () => clock;

	beforeEach(() => {
		clock = 1_000_000;
		resetGuestSchemaCompatForTests();
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('recognizes only missing engagement columns', () => {
		expect(isMissingEngagementColumnError(missingSelect)).toBe(true);
		expect(isMissingEngagementColumnError(missingWrite)).toBe(true);
		expect(isMissingEngagementColumnError(otherMissing)).toBe(false);
		expect(isMissingEngagementColumnError(new Error('is_test'))).toBe(false);
	});

	it('uses the full column set when the database has it', async () => {
		const run = jest.fn().mockResolvedValue('row');
		await expect(withGuestColumns(run, now)).resolves.toBe('row');
		expect(run).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith({ columns: GUEST_COLUMNS, engagement: true });
	});

	it('retries once with base columns and remembers the result for five minutes', async () => {
		const run = jest.fn().mockRejectedValueOnce(missingSelect).mockResolvedValue('row');
		await expect(withGuestColumns(run, now)).resolves.toBe('row');
		expect(run).toHaveBeenLastCalledWith({ columns: GUEST_BASE_COLUMNS, engagement: false });

		run.mockClear();
		clock += 4 * 60 * 1000;
		await withGuestColumns(run, now);
		expect(run).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith({ columns: GUEST_BASE_COLUMNS, engagement: false });

		run.mockClear();
		clock += 2 * 60 * 1000;
		await withGuestColumns(run, now);
		expect(run).toHaveBeenCalledWith({ columns: GUEST_COLUMNS, engagement: true });
	});

	it('rethrows unrelated errors without falling back', async () => {
		const run = jest.fn().mockRejectedValue(otherMissing);
		await expect(withGuestColumns(run, now)).rejects.toBe(otherMissing);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('strips the test flag for a base-column write and refuses to drop a requested test guest', () => {
		const base = { columns: GUEST_BASE_COLUMNS, engagement: false };
		expect(stripEngagementWriteFields({ full_name: 'Ana', is_test: false }, base)).toEqual({
			full_name: 'Ana',
		});
		expect(() => stripEngagementWriteFields({ is_test: true }, base)).toThrow(
			'La opción «Invitado de prueba» estará disponible cuando se actualice la base de datos.',
		);
		const full = { columns: GUEST_COLUMNS, engagement: true };
		expect(stripEngagementWriteFields({ is_test: true }, full)).toEqual({ is_test: true });
	});
});

describe('engagement ledger guard', () => {
	let clock = 1_000_000;
	const now = () => clock;

	beforeEach(() => {
		clock = 1_000_000;
		resetEngagementLedgerGuardForTests();
		restMock.mockReset();
	});

	it('skips the RPC for five minutes after the database reports it missing', async () => {
		restMock.mockRejectedValueOnce(
			new SupabaseHttpError(404, '{"code":"PGRST202"}', 'PGRST202'),
		);
		await expect(recordGuestEngagementEventsRpc('i', [], null, now)).rejects.toMatchObject({
			code: 'PGRST202',
		});
		await expect(recordGuestEngagementEventsRpc('i', [], null, now)).rejects.toMatchObject({
			status: 503,
		});
		expect(restMock).toHaveBeenCalledTimes(1);

		clock += 5 * 60 * 1000 + 1;
		restMock.mockResolvedValueOnce({ status: 'ok', accepted: 0, duplicates: 0, rejected: 0 });
		await expect(recordGuestEngagementEventsRpc('i', [], null, now)).resolves.toMatchObject({
			status: 'ok',
		});
	});

	it('does not trip on ordinary failures', async () => {
		restMock.mockRejectedValueOnce(new Error('network'));
		await expect(recordGuestEngagementEventsRpc('i', [], null, now)).rejects.toThrow('network');
		restMock.mockResolvedValueOnce({ status: 'not_found' });
		await expect(recordGuestEngagementEventsRpc('i', [], null, now)).resolves.toEqual({
			status: 'not_found',
		});
	});
});
