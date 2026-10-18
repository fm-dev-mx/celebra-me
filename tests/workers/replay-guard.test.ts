/**
 * @jest-environment node
 */
import { ReplayGuard } from '../../workers/shared/replay-guard';

type ReplayRecord = { expiresAt: number };

const NOW = new Date('2026-10-18T12:00:00.000Z').getTime();

type ReplayState = ConstructorParameters<typeof ReplayGuard>[0];

function createState() {
	const entries = new Map<string, ReplayRecord>();
	const storage = {
		alarm: undefined as number | undefined,
		async get<T>(key: string): Promise<T | undefined> {
			return entries.get(key) as T | undefined;
		},
		async put<T>(key: string, value: T): Promise<void> {
			entries.set(key, value as ReplayRecord);
		},
		async list<T>(): Promise<Map<string, T>> {
			return new Map(entries) as Map<string, T>;
		},
		async delete(key: string): Promise<boolean> {
			return entries.delete(key);
		},
		deleteAll: jest.fn(async () => {
			entries.clear();
			storage.alarm = undefined;
		}),
		async setAlarm(time: number | Date): Promise<void> {
			storage.alarm = Number(time);
		},
	};
	const state: ReplayState = {
		storage,
		blockConcurrencyWhile: <T>(callback: () => Promise<T>) => callback(),
	};
	return { entries, storage, state };
}

function claim(guard: ReplayGuard, key: string, expiresAt: number) {
	return guard.fetch(
		new Request('https://replay-guard/claim', {
			method: 'POST',
			body: JSON.stringify({ key, expiresAt }),
		}),
	);
}

describe('ReplayGuard', () => {
	let now = NOW;

	beforeEach(() => {
		now = NOW;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('accepts a key once and rejects the replay until it expires', async () => {
		const { state, storage } = createState();
		const guard = new ReplayGuard(state);

		expect((await claim(guard, 'nonce-0001', NOW + 60_000)).status).toBe(204);
		expect((await claim(guard, 'nonce-0001', NOW + 60_000)).status).toBe(409);
		expect(storage.alarm).toBe(NOW + 60_000);
	});

	it('wipes the whole object once every key has expired', async () => {
		const { state, storage, entries } = createState();
		const guard = new ReplayGuard(state);
		await claim(guard, 'nonce-0001', NOW + 60_000);

		now = NOW + 60_000;
		await guard.alarm();

		expect(storage.deleteAll).toHaveBeenCalledTimes(1);
		expect(entries.size).toBe(0);
		expect(storage.alarm).toBeUndefined();
	});

	it('keeps live keys and re-arms the alarm for the earliest one', async () => {
		const { state, storage, entries } = createState();
		const guard = new ReplayGuard(state);
		entries.set('nonce-expired', { expiresAt: NOW - 1 });
		entries.set('nonce-later', { expiresAt: NOW + 120_000 });
		entries.set('nonce-sooner', { expiresAt: NOW + 30_000 });

		await guard.alarm();

		expect(storage.deleteAll).not.toHaveBeenCalled();
		expect([...entries.keys()].sort()).toEqual(['nonce-later', 'nonce-sooner']);
		expect(storage.alarm).toBe(NOW + 30_000);
	});
});
