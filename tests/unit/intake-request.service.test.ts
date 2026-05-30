jest.mock('@/lib/intake/repositories/intake-request.repository', () => ({
	findIntakeRequestById: jest.fn(),
	findIntakeRequestByTokenHash: jest.fn(),
	findIntakeRequestsByProjectId: jest.fn(),
	createIntakeRequest: jest.fn(),
	updateIntakeRequest: jest.fn(),
}));

jest.mock('@/lib/intake/services/intake-token.service', () => ({
	generateIntakeToken: jest.fn(() => 'mock-raw-token-abc123'),
	hashIntakeToken: jest.fn((token: string) => `hashed-${token}`),
	encryptIntakeToken: jest.fn(() => 'v1.iv.tag.ciphertext'),
	decryptIntakeToken: jest.fn(() => 'mock-raw-token-abc123'),
}));

jest.mock('@/lib/server/env', () => ({
	getEnv: jest.fn(() => ''),
}));

import {
	findIntakeRequestByTokenHash,
	createIntakeRequest,
	updateIntakeRequest,
} from '@/lib/intake/repositories/intake-request.repository';
import {
	decryptIntakeToken,
	generateIntakeToken,
	hashIntakeToken,
} from '@/lib/intake/services/intake-token.service';
import {
	createRequest,
	regenerateToken,
	revokeRequest,
	getIntakeRequestByToken,
	resolveCaptureLink,
} from '@/lib/intake/services/intake-request.service';
import { CreateIntakeRequestSchema } from '@/lib/intake/schemas/intake-request.schema';

const mockCreate = createIntakeRequest as jest.MockedFunction<typeof createIntakeRequest>;
const mockUpdate = updateIntakeRequest as jest.MockedFunction<typeof updateIntakeRequest>;
const mockFindByTokenHash = findIntakeRequestByTokenHash as jest.MockedFunction<
	typeof findIntakeRequestByTokenHash
>;
const mockDecrypt = decryptIntakeToken as jest.MockedFunction<typeof decryptIntakeToken>;

const baseRequest = {
	id: 'req-1',
	invitationProjectId: 'proj-1',
	tokenHash: 'hashed-mock-raw-token-abc123',
	tokenCiphertext: 'v1.iv.tag.ciphertext',
	status: 'active' as const,
	enabledBlocks: ['event-details' as const, 'photos' as const],
	expiresAt: '2026-06-28T00:00:00Z',
	createdAt: '2026-05-28T00:00:00Z',
	updatedAt: '2026-05-28T00:00:00Z',
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe('createRequest', () => {
	it('generates token, hashes it, and creates request', async () => {
		mockCreate.mockResolvedValue(baseRequest);

		const result = await createRequest({
			invitationProjectId: 'proj-1',
			enabledBlocks: ['event-details', 'photos'],
		});

		expect(result.rawToken).toBe('mock-raw-token-abc123');
		expect(result.request).toEqual(baseRequest);
		expect(generateIntakeToken).toHaveBeenCalled();
		expect(hashIntakeToken).toHaveBeenCalledWith('mock-raw-token-abc123');
		expect(mockCreate).toHaveBeenCalledWith({
			invitationProjectId: 'proj-1',
			tokenHash: 'hashed-mock-raw-token-abc123',
			tokenCiphertext: 'v1.iv.tag.ciphertext',
			enabledBlocks: ['event-details', 'photos'],
			expiresAt: expect.any(String),
		});
	});

	it('uses custom expiry days', async () => {
		mockCreate.mockResolvedValue(baseRequest);

		await createRequest({
			invitationProjectId: 'proj-1',
			enabledBlocks: ['event-details'],
			expiresInDays: 7,
		});

		const call = mockCreate.mock.calls[0][0];
		expect(call.expiresAt).not.toBeNull();
		const expiresAt = new Date(call.expiresAt as string);
		const now = new Date();
		const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		expect(diffDays).toBeGreaterThanOrEqual(6);
		expect(diffDays).toBeLessThanOrEqual(8);
	});
});

describe('regenerateToken', () => {
	it('generates new token and resets status to active', async () => {
		const updated = {
			...baseRequest,
			tokenHash: 'hashed-mock-raw-token-abc123',
			tokenCiphertext: 'v1.iv.tag.ciphertext',
			status: 'active' as const,
		};
		mockUpdate.mockResolvedValue(updated);

		const result = await regenerateToken('req-1');

		expect(result.rawToken).toBe('mock-raw-token-abc123');
		expect(mockUpdate).toHaveBeenCalledWith('req-1', {
			tokenHash: 'hashed-mock-raw-token-abc123',
			tokenCiphertext: 'v1.iv.tag.ciphertext',
			status: 'active',
			expiresAt: expect.any(String),
		});
	});
});

describe('revokeRequest', () => {
	it('sets status to closed', async () => {
		const closed = { ...baseRequest, status: 'closed' as const };
		mockUpdate.mockResolvedValue(closed);

		const result = await revokeRequest('req-1');
		expect(result.status).toBe('closed');
		expect(mockUpdate).toHaveBeenCalledWith('req-1', { status: 'closed' });
	});
});

describe('getIntakeRequestByToken', () => {
	it('hashes token and looks up by hash', async () => {
		mockFindByTokenHash.mockResolvedValue(baseRequest);

		const result = await getIntakeRequestByToken('some-raw-token');
		expect(hashIntakeToken).toHaveBeenCalledWith('some-raw-token');
		expect(mockFindByTokenHash).toHaveBeenCalledWith('hashed-some-raw-token');
		expect(result).toEqual(baseRequest);
	});

	it('returns null when token hash not found', async () => {
		mockFindByTokenHash.mockResolvedValue(null);

		const result = await getIntakeRequestByToken('invalid-token');
		expect(result).toBeNull();
	});
});

describe('CreateIntakeRequestSchema', () => {
	it('accepts enabledBlocks and expiresInDays without invitationProjectId', () => {
		const result = CreateIntakeRequestSchema.safeParse({
			enabledBlocks: ['event-details', 'photos'],
			expiresInDays: 14,
		});
		expect(result.success).toBe(true);
	});

	it('defaults expiresInDays to 30 when not provided', () => {
		const result = CreateIntakeRequestSchema.safeParse({
			enabledBlocks: ['music'],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.expiresInDays).toBe(30);
		}
	});

	it('rejects empty enabledBlocks', () => {
		const result = CreateIntakeRequestSchema.safeParse({
			enabledBlocks: [],
			expiresInDays: 14,
		});
		expect(result.success).toBe(false);
	});

	it('rejects expiresInDays outside valid range', () => {
		const result = CreateIntakeRequestSchema.safeParse({
			enabledBlocks: ['event-details'],
			expiresInDays: 500,
		});
		expect(result.success).toBe(false);
	});

	it('rejects unknown block types', () => {
		const result = CreateIntakeRequestSchema.safeParse({
			enabledBlocks: ['invalid-block'],
		});
		expect(result.success).toBe(false);
	});
});

describe('resolveCaptureLink', () => {
	it('returns an active capture URL using localhost fallback when BASE_URL is not set', () => {
		mockDecrypt.mockReturnValue('recoverable-token');

		const result = resolveCaptureLink(baseRequest);
		expect(result.captureUrl).toBe('http://localhost:4321/captura/recoverable-token');
		expect(result.captureLinkStatus).toBe('active');
	});

	it('uses options.baseUrl when provided', () => {
		mockDecrypt.mockReturnValue('recoverable-token');

		const result = resolveCaptureLink(baseRequest, {
			baseUrl: 'https://www.celebra-me.com',
		});
		expect(result.captureUrl).toBe('https://www.celebra-me.com/captura/recoverable-token');
		expect(result.captureLinkStatus).toBe('active');
	});

	it('normalizes trailing slash from options.baseUrl', () => {
		mockDecrypt.mockReturnValue('recoverable-token');

		const result = resolveCaptureLink(baseRequest, {
			baseUrl: 'https://www.celebra-me.com/',
		});
		expect(result.captureUrl).toBe('https://www.celebra-me.com/captura/recoverable-token');
		expect(result.captureLinkStatus).toBe('active');
	});

	it('reports unavailable for legacy rows without ciphertext', () => {
		expect(resolveCaptureLink({ ...baseRequest, tokenCiphertext: null })).toEqual({
			captureUrl: null,
			captureLinkStatus: 'unavailable',
		});
	});

	it('reports revoked without exposing a stored token', () => {
		expect(resolveCaptureLink({ ...baseRequest, status: 'closed' })).toEqual({
			captureUrl: null,
			captureLinkStatus: 'revoked',
		});
	});

	it('reports expired without exposing a stored token', () => {
		expect(resolveCaptureLink({ ...baseRequest, expiresAt: '2020-01-01T00:00:00Z' })).toEqual({
			captureUrl: null,
			captureLinkStatus: 'expired',
		});
	});
});
