const mockRest = jest.fn();
const mockAudit = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/rsvp/repositories/supabase', () => ({ supabaseRestRequest: mockRest }));
jest.mock('@/lib/memories/valentina-memories-audit', () => ({
	appendValentinaMemoriesAudit: mockAudit,
}));
jest.mock('@/lib/memories/valentina-memories-retrieval', () => ({
	deleteValentinaMemoryObject: mockDelete,
}));
jest.mock('@/lib/memories/valentina-memories.service', () => ({
	hashValentinaMemorySecret: (value: string) => value,
	reconcileValentinaMemoryValidation: jest.fn(),
}));
import { cleanupValentinaMemoryObjects } from '@/lib/memories/valentina-memories-cleanup.service';

describe('cleanup provider operations', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockAudit.mockResolvedValue(undefined);
	});
	it('uses five bounded database operations and no object operations for an empty batch', async () => {
		mockRest.mockImplementation(async ({ pathWithQuery }: { pathWithQuery: string }) =>
			pathWithQuery.startsWith('rpc/') && !pathWithQuery.includes('claim_') ? 0 : [],
		);
		await cleanupValentinaMemoryObjects();
		expect(mockRest).toHaveBeenCalledTimes(5);
		expect(mockDelete).not.toHaveBeenCalled();
		expect(mockAudit).not.toHaveBeenCalled();
	});
	it('delegates empty-session checks and audit atomically and excludes completed sessions', async () => {
		let completed = false;
		mockRest.mockImplementation(async ({ pathWithQuery }: { pathWithQuery: string }) => {
			if (pathWithQuery.startsWith('valentina_memory_sessions?select=')) {
				expect(pathWithQuery).toContain('anonymized_at=is.null');
				expect(pathWithQuery).toContain('order=expires_at.asc,id.asc');
				return completed ? [] : [{ id: 'synthetic-session' }];
			}
			if (pathWithQuery === 'rpc/anonymize_valentina_memory_session') {
				completed = true;
				return true;
			}
			return pathWithQuery.startsWith('rpc/') && !pathWithQuery.includes('claim_') ? 0 : [];
		});
		await cleanupValentinaMemoryObjects();
		await cleanupValentinaMemoryObjects();
		const calls = mockRest.mock.calls.filter(
			([call]) => call.pathWithQuery === 'rpc/anonymize_valentina_memory_session',
		);
		expect(calls).toHaveLength(1);
		expect(calls[0][0]).toMatchObject({
			method: 'POST',
			useServiceRole: true,
			body: { p_session_id: 'synthetic-session' },
		});
		expect(mockRest.mock.calls.some(([call]) => call.method === 'PATCH')).toBe(false);
		expect(mockAudit).not.toHaveBeenCalled();
	});
	it('does not fall back to non-atomic writes when the migration is unavailable', async () => {
		mockRest.mockImplementation(async ({ pathWithQuery }: { pathWithQuery: string }) => {
			if (pathWithQuery.startsWith('valentina_memory_sessions?select='))
				return [{ id: 'synthetic-session' }];
			if (pathWithQuery === 'rpc/anonymize_valentina_memory_session')
				throw new Error('RPC unavailable');
			return [];
		});
		await expect(cleanupValentinaMemoryObjects()).rejects.toThrow('RPC unavailable');
		expect(mockRest.mock.calls.some(([call]) => call.method === 'PATCH')).toBe(false);
		expect(mockAudit).not.toHaveBeenCalled();
	});
});
