import { CloudinaryQuota } from '../../scripts/provision/cloudinary-quota';

const start = Date.parse('2026-09-13T20:10:00Z');
const reset = '2026-09-13T21:00:00Z';
const response = (remaining: number, resetAt = reset) => ({
	rate_limit_allowed: 500,
	rate_limit_remaining: remaining,
	rate_limit_reset_at: resetAt,
});

describe('operation-scoped Cloudinary quota', () => {
	it('reserves 10 percent before an invitation and counts quota reads separately', async () => {
		const usage = jest.fn().mockResolvedValue(response(88));
		const quota = new CloudinaryQuota(usage, () => start);
		await quota.beginInvitation(38);
		await quota.beforeRequest();
		quota.observe(response(87));
		expect(quota.summary()).toMatchObject({
			resourceCalls: 1,
			quotaCalls: 1,
			remaining: 87,
			observedAccountConsumption: 1,
		});
		usage.mockResolvedValue(response(70));
		await expect(quota.beginInvitation(38)).rejects.toThrow('insufficient balance');
		expect(usage).toHaveBeenCalledTimes(2);
		await expect(quota.beforeRequest()).rejects.toThrow('operation stopped');
	});

	it('stops after an unexpected shared-account drop', async () => {
		const quota = new CloudinaryQuota(
			async () => response(200),
			() => start,
		);
		await quota.beginInvitation(20);
		await quota.beforeRequest();
		quota.observe(response(50));
		await expect(quota.beforeRequest()).rejects.toThrow('insufficient balance');
		expect(quota.summary().resourceCalls).toBe(1);
		expect(quota.summary().observedAccountConsumption).toBe(150);
	});

	it('refreshes missing metadata once and blocks if still unavailable', async () => {
		const usage = jest.fn().mockResolvedValueOnce(response(200)).mockResolvedValue({});
		const quota = new CloudinaryQuota(usage, () => start);
		await quota.beginInvitation(2);
		await quota.beforeRequest();
		quota.observe({});
		await expect(quota.beforeRequest()).rejects.toThrow('metadata unavailable');
		await expect(quota.beforeRequest()).rejects.toThrow('operation stopped');
		expect(usage).toHaveBeenCalledTimes(2);
	});

	it('refreshes a stale observation and accepts a newly verified window', async () => {
		let now = start;
		const usage = jest.fn().mockResolvedValue(response(200));
		const quota = new CloudinaryQuota(usage, () => now);
		await quota.beginInvitation(2);
		now += 60_000;
		await quota.beforeRequest();
		expect(usage).toHaveBeenCalledTimes(2);
		now = Date.parse(reset);
		usage.mockResolvedValue(response(499, '2026-09-13T22:00:00Z'));
		await quota.beforeRequest();
		expect(quota.summary().remaining).toBe(498);
	});

	it.each([420, 429])(
		'stops permanently on HTTP %i without leaking SDK errors',
		async (status) => {
			const quota = new CloudinaryQuota(
				async () => response(200),
				() => start,
			);
			await quota.beginInvitation(2);
			await quota.beforeRequest();
			expect(() => quota.failed(status)).toThrow(`HTTP ${status}`);
			await expect(quota.beforeRequest()).rejects.toThrow('operation stopped');
		},
	);

	it('retains safe reset headers from a rejected quota query and strips credentials', async () => {
		const quota = new CloudinaryQuota(
			async () => {
				throw { http_code: 420, request_options: { auth: 'secret' }, quota: response(0) };
			},
			() => start,
		);
		await expect(quota.beginInvitation(2)).rejects.toThrow('2026-09-13T21:00:00.000Z');
		expect(JSON.stringify(quota.summary())).not.toContain('secret');
	});
});
