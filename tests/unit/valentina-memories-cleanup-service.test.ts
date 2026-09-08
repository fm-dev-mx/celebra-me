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
	it('documents the repeated anonymization gap for a previously anonymized empty session', async () => {
		// Characterization of an unresolved gap: revoked_at alone is not an anonymization marker.
		const session = {
			id: 'synthetic-session',
			display_name: 'Invitado retirado',
			revoked_at: '2020-01-01T00:00:00.000Z',
			expires_at: '2020-01-01T00:00:00.000Z',
		};
		mockRest.mockImplementation(
			async ({
				pathWithQuery,
				method,
				body,
			}: {
				pathWithQuery: string;
				method?: string;
				body?: Record<string, unknown>;
			}) => {
				if (method === 'PATCH') {
					Object.assign(session, body);
					return [];
				}
				if (pathWithQuery.startsWith('valentina_memory_sessions?select=')) return [session];
				return pathWithQuery.startsWith('rpc/') && !pathWithQuery.includes('claim_')
					? 0
					: [];
			},
		);
		await cleanupValentinaMemoryObjects();
		await cleanupValentinaMemoryObjects();
		expect(mockRest.mock.calls.filter(([call]) => call.method === 'PATCH')).toHaveLength(2);
		expect(
			mockAudit.mock.calls.filter(([call]) => call.action === 'guest_session_anonymized'),
		).toHaveLength(2);
		expect(mockDelete).not.toHaveBeenCalled();
	});
	it('preserves session data while an undeleted item still exists', async () => {
		mockRest.mockImplementation(async ({ pathWithQuery }: { pathWithQuery: string }) => {
			if (pathWithQuery.startsWith('valentina_memory_sessions?select='))
				return [{ id: 'synthetic-session' }];
			if (pathWithQuery.includes('object_deleted_at=is.null'))
				return [{ id: 'retained-item' }];
			return pathWithQuery.startsWith('rpc/') && !pathWithQuery.includes('claim_') ? 0 : [];
		});
		await cleanupValentinaMemoryObjects();
		expect(mockRest.mock.calls.some(([call]) => call.method === 'PATCH')).toBe(false);
		expect(mockAudit).not.toHaveBeenCalled();
	});
});
