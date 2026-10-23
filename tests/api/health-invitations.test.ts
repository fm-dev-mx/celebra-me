import type { APIContext } from 'astro';
import {
	listPublishedClientEntriesWithAccess,
	type PublicPublishedInvitationContent,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { GET } from '@/pages/api/health/invitations';
import validPublishedContentJson from '../fixtures/content/xv-jewelry-box.json';

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	listPublishedClientEntriesWithAccess: jest.fn(),
}));

const mockList = listPublishedClientEntriesWithAccess as jest.MockedFunction<
	typeof listPublishedClientEntriesWithAccess
>;

const validContent = validPublishedContentJson as unknown as Record<string, unknown>;

// The fixture's event date (2026-11-21) must stay inside its validity window.
const PINNED_NOW = new Date('2026-10-13T12:00:00.000Z');
beforeAll(() => {
	jest.useFakeTimers({ now: PINNED_NOW, doNotFake: ['nextTick', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

function entry(
	slug: string,
	overrides: Partial<PublicPublishedInvitationContent> = {},
): PublicPublishedInvitationContent {
	return {
		id: `published-${slug}`,
		invitationId: `invitation-${slug}`,
		slug,
		eventType: 'xv',
		isDemo: false,
		content: validContent,
		version: 1,
		publishedAt: '2026-10-01T00:00:00.000Z',
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		access: { paymentStatus: 'paid', publicAccess: 'enabled' },
		...overrides,
	};
}

async function readBody(response: Response) {
	return (await response.json()) as {
		status: string;
		checks: { database: { status: string }; invitations?: { active: number; failing: number } };
	};
}

describe('GET /api/health/invitations', () => {
	beforeEach(() => mockList.mockReset());

	it('counts live invitations and skips disabled or expired ones', async () => {
		const expiredContent = {
			...validContent,
			eventTiming: undefined,
			hero: { ...(validContent.hero as Record<string, unknown>), date: '2020-01-01' },
		};
		mockList.mockResolvedValue([
			entry('ana'),
			entry('bea'),
			entry('off', { access: { paymentStatus: 'paid', publicAccess: 'disabled' } }),
			entry('old', { content: expiredContent }),
		]);

		const response = await GET({} as unknown as APIContext);
		const body = await readBody(response);

		expect(response.status).toBe(200);
		expect(body.status).toBe('healthy');
		expect(body.checks).toEqual({
			database: { status: 'ok' },
			invitations: { active: 2, failing: 0 },
		});
		expect(mockList).toHaveBeenCalledWith(5000);
	});

	it('answers 503 with counts only and logs the failing route', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockList.mockResolvedValue([
			entry('ana'),
			entry('broken', { content: { ...validContent, theme: 'not-an-object' } }),
		]);

		const response = await GET({} as unknown as APIContext);
		const body = await readBody(response);

		expect(response.status).toBe(503);
		expect(body.status).toBe('unhealthy');
		expect(body.checks.invitations).toEqual({ active: 2, failing: 1 });
		expect(JSON.stringify(body)).not.toContain('broken');
		expect(JSON.stringify(consoleError.mock.calls)).toContain('/xv/broken');
		consoleError.mockRestore();
	});

	it('answers 503 without details when the database read fails', async () => {
		const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockList.mockRejectedValue(new Error('connect ECONNREFUSED secret-host'));

		const response = await GET({} as unknown as APIContext);
		const body = await readBody(response);

		expect(response.status).toBe(503);
		expect(body.checks).toEqual({ database: { status: 'error' } });
		expect(JSON.stringify(body)).not.toContain('secret-host');
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-host');
		consoleError.mockRestore();
	});
});
