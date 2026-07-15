import { getRoutableEventEntry } from '@/lib/content/events';
import { getCollection } from 'astro:content';

jest.mock('astro:content', () => ({
	getCollection: jest.fn(),
}));

describe('getRoutableEventEntry Static Fallback Guard', () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.ENABLE_STATIC_EVENTS;
		jest.clearAllMocks();
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.ENABLE_STATIC_EVENTS;
		} else {
			process.env.ENABLE_STATIC_EVENTS = originalEnv;
		}
	});

	it('does not query events collection by default', async () => {
		delete process.env.ENABLE_STATIC_EVENTS;
		const mockGetCollection = getCollection as jest.Mock;
		mockGetCollection.mockResolvedValue([]);

		await getRoutableEventEntry('some-slug', 'boda');

		// event-demos and event-templates should still be queried
		expect(mockGetCollection).toHaveBeenCalledWith('event-demos');
		expect(mockGetCollection).toHaveBeenCalledWith('event-templates');
		// events collection should NOT be queried
		expect(mockGetCollection).not.toHaveBeenCalledWith('events');
	});

	it('queries events collection when ENABLE_STATIC_EVENTS is true', async () => {
		process.env.ENABLE_STATIC_EVENTS = 'true';
		const mockGetCollection = getCollection as jest.Mock;
		mockGetCollection.mockResolvedValue([]);

		await getRoutableEventEntry('some-slug', 'boda');

		expect(mockGetCollection).toHaveBeenCalledWith('events');
		expect(mockGetCollection).toHaveBeenCalledWith('event-demos');
		expect(mockGetCollection).toHaveBeenCalledWith('event-templates');
	});
});
