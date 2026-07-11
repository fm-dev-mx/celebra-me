import { createGa4EventQueue } from '@/lib/tracking/ga4-queue';

describe('createGa4EventQueue', () => {
	it('replays queued events in FIFO order and skips the deferred page view once one was queued', () => {
		const queue = createGa4EventQueue(30);
		const replayed: Array<[string, Record<string, string | number | boolean>]> = [];
		const deferredPageViews: string[] = [];

		queue.enqueue('page_viewed', { page_type: 'commercial' });
		queue.enqueue('section_seen', { section_id: 'hero', visibility_bucket: 50 });

		queue.flush(
			(eventName, eventProperties) => {
				replayed.push([eventName, eventProperties]);
				if (eventName === 'page_viewed') queue.markPageViewForwarded();
			},
			() => {
				deferredPageViews.push('page_viewed');
			},
		);

		expect(replayed).toEqual([
			['page_viewed', { page_type: 'commercial' }],
			['section_seen', { section_id: 'hero', visibility_bucket: 50 }],
		]);
		expect(deferredPageViews).toHaveLength(0);
		expect(queue.getPendingCount()).toBe(0);
	});

	it('sends a deferred page view when no queued event marked it as forwarded', () => {
		const queue = createGa4EventQueue(30);
		const replayed: Array<[string, Record<string, string | number | boolean>]> = [];
		const deferredPageViews: string[] = [];

		queue.enqueue('section_seen', { section_id: 'hero' });

		queue.flush(
			(eventName, eventProperties) => {
				replayed.push([eventName, eventProperties]);
			},
			() => {
				deferredPageViews.push('page_viewed');
				queue.markPageViewForwarded();
			},
		);

		expect(replayed).toEqual([['section_seen', { section_id: 'hero' }]]);
		expect(deferredPageViews).toEqual(['page_viewed']);
		expect(queue.shouldForwardPageView()).toBe(false);
	});

	it('caps the queue size and clears pending events when requested', () => {
		const queue = createGa4EventQueue(2);

		queue.enqueue('scroll_depth_reached', { depth_bucket: 25 });
		queue.enqueue('scroll_depth_reached', { depth_bucket: 50 });
		queue.enqueue('scroll_depth_reached', { depth_bucket: 75 });

		expect(queue.getPendingCount()).toBe(2);

		queue.clear();

		expect(queue.getPendingCount()).toBe(0);
		queue.resetPageViewForwarded();
		expect(queue.shouldForwardPageView()).toBe(true);
	});
});
