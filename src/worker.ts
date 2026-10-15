/**
 * Cloudflare Workers entry point (`main` in `wrangler.jsonc`). The adapter's default entry
 * only exports `fetch`; this one adds `scheduled` for the cron triggers and adopts the
 * rate-limit and image bindings before the first request. Only the Cloudflare build (`CELEBRA_BUILD_TARGET=cloudflare`)
 * bundles this file.
 */
import { handle } from '@astrojs/cloudflare/handler';
import { installImagesBinding } from './lib/images/image-transformer-provider';
import { installRateLimitBindings } from './lib/rsvp/security/rate-limit-provider';
import { runScheduledJob } from './lib/server/scheduled-jobs';

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

export default {
	async fetch(
		request: Request,
		env: WorkerEnv,
		context: WorkerExecutionContext,
	): Promise<Response> {
		installRateLimitBindings(env);
		installImagesBinding(env);
		return handle(request, env as never, context as never);
	},

	async scheduled(
		controller: ScheduledController,
		env: WorkerEnv,
		context: WorkerExecutionContext,
	): Promise<void> {
		installRateLimitBindings(env);
		installImagesBinding(env);
		context.waitUntil(runScheduledJob(controller.cron));
	},
};
