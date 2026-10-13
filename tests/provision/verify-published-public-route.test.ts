import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
	verifyPublicRoute,
	type PublishedInvitation,
} from '../../scripts/invitation/verify-published-images.ts';

const ORIGIN = 'https://www.celebra-me.com/';

function invitation(publicAccess: PublishedInvitation['publicAccess']): PublishedInvitation {
	return { eventType: 'xv', slug: 'mia-pintor', content: {}, assets: [], publicAccess };
}

function respond(status: number) {
	jest.spyOn(globalThis, 'fetch').mockResolvedValue(
		new Response('<html><body></body></html>', { status }),
	);
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe('public route verification', () => {
	it('passes an enabled invitation that answers 200', async () => {
		respond(200);
		await expect(verifyPublicRoute(ORIGIN, invitation('enabled'))).resolves.toBeNull();
	});

	it('expects the neutral 403 page for an invitation the administrator disabled', async () => {
		respond(403);
		await expect(verifyPublicRoute(ORIGIN, invitation('disabled'))).resolves.toBeNull();
	});

	it('fails a disabled invitation that is still publicly reachable', async () => {
		respond(200);
		const row = await verifyPublicRoute(ORIGIN, invitation('disabled'));
		expect(row?.reasons).toEqual(['disabled invitation answered HTTP 200, expected 403']);
	});

	it('fails an enabled invitation that answers an error', async () => {
		respond(403);
		const row = await verifyPublicRoute(ORIGIN, invitation('enabled'));
		expect(row?.reasons).toEqual(['public route HTTP 403']);
	});
});
