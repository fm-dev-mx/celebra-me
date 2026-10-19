/**
 * Cloudflare Workers entry point (`main` in `wrangler.jsonc`). The adapter's default entry
 * only exports `fetch`; this one adds `scheduled` for the cron triggers and adopts the
 * rate-limit, image, invitation-media, static-asset and memories Worker bindings, plus the
 * in-process app loopback, before the first request. `astro build` bundles this file.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { redirectApexToCanonical } from './lib/server/apex-redirect';
import { installAppLoopback } from './lib/server/app-loopback';
import { installImagesBinding } from './lib/images/image-transformer-provider';
import { installInvitationMediaBinding } from './lib/intake/services/r2-invitation-media';
import { installMemoriesWorkerBindings } from './lib/memories/server/worker-bindings';
import { installRateLimitBindings } from './lib/rsvp/security/rate-limit-provider';
import { runScheduledJob } from './lib/server/scheduled-jobs';
import { installAssetsBinding } from './lib/server/static-assets-provider';

// Minimal shapes of the Workers runtime types; the repository does not load the
// `@cloudflare/workers-types` globals for the application sources.
type WorkerEnv = Record<string, unknown>;

interface WorkerExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
	passThroughOnException(): void;
}

interface ScheduledController {
	readonly cron: string;
	readonly scheduledTime: number;
}

/**
 * Concurrent requests share the isolate, so the installed loopback may carry the context of
 * a request that already answered; its `waitUntil` must never break the inner render.
 */
function loopbackContext(context: WorkerExecutionContext): WorkerExecutionContext {
	return {
		waitUntil(promise) {
			try {
				context.waitUntil(promise);
			} catch {
				void promise.catch(() => undefined);
			}
		},
		passThroughOnException() {},
	};
}

export default {
	async fetch(
		request: Request,
		env: WorkerEnv,
		context: WorkerExecutionContext,
	): Promise<Response> {
		installRateLimitBindings(env);
		installImagesBinding(env);
		installInvitationMediaBinding(env);
		installAssetsBinding(env);
		installMemoriesWorkerBindings(env);
		installAppLoopback(
			async (inner) =>
				redirectApexToCanonical(inner) ??
				handle(inner, env as never, loopbackContext(context) as never),
		);
		return redirectApexToCanonical(request) ?? handle(request, env as never, context as never);
	},

	async scheduled(
		controller: ScheduledController,
		env: WorkerEnv,
		context: WorkerExecutionContext,
	): Promise<void> {
		installRateLimitBindings(env);
		installImagesBinding(env);
		installInvitationMediaBinding(env);
		installMemoriesWorkerBindings(env);
		context.waitUntil(runScheduledJob(controller.cron));
	},
};
