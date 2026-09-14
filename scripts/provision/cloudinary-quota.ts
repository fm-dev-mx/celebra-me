import type { CloudinaryAdminObserver } from '../../src/lib/intake/services/cloudinary-assets.ts';
import { getCloudinaryErrorStatus } from '../../src/lib/intake/services/cloudinary-assets.ts';

interface Balance {
	limit: number;
	remaining: number;
	resetAt: number;
	observedAt: number;
}

export class CloudinaryQuotaError extends Error {
	constructor(reason: string, resetAt?: number) {
		super(
			`Cloudinary quota blocked: ${reason}; reset ${resetAt ? new Date(resetAt).toISOString() : 'UNVERIFIED'}. No automatic retry.`,
		);
		this.name = 'CloudinaryQuotaError';
	}
}

/** One sequential CLI operation; no persistent cache and no account-wide lock. */
export class CloudinaryQuota implements CloudinaryAdminObserver {
	private balance?: Balance;
	private lastObserved?: Balance;
	private invalid = true;
	private stopped = false;
	private resourceCalls = 0;
	private quotaCalls = 0;
	private observedConsumption = 0;
	constructor(
		private readonly readUsage: () => Promise<unknown>,
		private readonly now = Date.now,
	) {}

	observe(response: unknown): void {
		const data = response as Record<string, unknown> | null;
		const limit = data?.rate_limit_allowed;
		const remaining = data?.rate_limit_remaining;
		const rawReset = data?.rate_limit_reset_at;
		const resetAt =
			rawReset instanceof Date
				? rawReset.getTime()
				: typeof rawReset === 'string'
					? Date.parse(rawReset)
					: NaN;
		if (
			typeof limit !== 'number' ||
			!Number.isInteger(limit) ||
			limit <= 0 ||
			typeof remaining !== 'number' ||
			!Number.isInteger(remaining) ||
			remaining < 0 ||
			remaining > limit ||
			!Number.isFinite(resetAt) ||
			resetAt <= this.now()
		) {
			this.invalid = true;
			return;
		}
		const observed = { limit, remaining, resetAt, observedAt: this.now() };
		if (this.lastObserved?.resetAt === resetAt)
			this.observedConsumption += Math.max(0, this.lastObserved.remaining - remaining);
		this.lastObserved = observed;
		// Never regain locally spent budget from a delayed response within the same window.
		this.balance = {
			...observed,
			remaining:
				this.balance?.resetAt === resetAt
					? Math.min(this.balance.remaining, remaining)
					: remaining,
		};
		this.invalid = false;
	}

	failed(status: number | undefined): void {
		if (status === 420 || status === 429) {
			this.stopped = true;
			throw new CloudinaryQuotaError(`HTTP ${status}`, this.balance?.resetAt);
		}
		// SDK errors lack quota headers. The request was already charged locally.
	}

	private async refresh(): Promise<void> {
		this.quotaCalls++;
		if (this.balance) this.balance.remaining = Math.max(0, this.balance.remaining - 1);
		try {
			this.observe(await this.readUsage());
		} catch (error) {
			if (error && typeof error === 'object' && 'quota' in error) this.observe(error.quota);
			this.stopped = true;
			const status = getCloudinaryErrorStatus(error);
			throw new CloudinaryQuotaError(
				status ? `quota query HTTP ${status}` : 'quota query unavailable',
				this.balance?.resetAt,
			);
		}
		if (this.invalid) {
			this.stopped = true;
			throw new CloudinaryQuotaError('quota metadata unavailable', this.balance?.resetAt);
		}
	}

	private async requireBalance(calls: number, fresh = false): Promise<void> {
		if (this.stopped)
			throw new CloudinaryQuotaError('operation stopped', this.balance?.resetAt);
		if (
			fresh ||
			this.invalid ||
			!this.balance ||
			this.now() - this.balance.observedAt >= 60_000 ||
			this.now() >= this.balance.resetAt
		)
			await this.refresh();
		const balance = this.balance!;
		if (balance.remaining < calls + Math.ceil(balance.limit * 0.1)) {
			this.stopped = true;
			throw new CloudinaryQuotaError(
				`insufficient balance (${balance.remaining} remaining, ${calls} required, ${Math.ceil(balance.limit * 0.1)} reserved)`,
				balance.resetAt,
			);
		}
	}

	async beginInvitation(adminCalls: number): Promise<void> {
		if (!Number.isSafeInteger(adminCalls) || adminCalls < 0)
			throw new Error('Invalid Admin call budget.');
		if (adminCalls === 0) return;
		// Recheck the shared account between invitations, not only at process startup.
		await this.requireBalance(adminCalls, true);
	}

	async beforeRequest(): Promise<void> {
		await this.requireBalance(1);
		this.balance!.remaining--;
		this.resourceCalls++;
	}

	summary() {
		return {
			resourceCalls: this.resourceCalls,
			quotaCalls: this.quotaCalls,
			observedAccountConsumption: this.lastObserved ? this.observedConsumption : null,
			remaining: this.balance?.remaining ?? null,
			resetAt: this.balance ? new Date(this.balance.resetAt).toISOString() : null,
		};
	}
}
