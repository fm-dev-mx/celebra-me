/**
 * Picks the image engine of the running host. The Cloudflare Worker entry installs the
 * `IMAGES` binding before the first request (`src/worker.ts`); every other host (Vercel, the
 * dev server, tests) uses `sharp`. Inside Workers without the binding the lookup fails
 * loudly: `sharp` cannot load there.
 */
import { isCloudflareWorkersRuntime } from '@/lib/server/platform-request';
import type { ImagesBinding } from './cloudflare-image-transformer';
import type { ImageTransformer } from './image-transformer';

let installedBinding: ImagesBinding | undefined;
let cloudflareTransformer: ImageTransformer | undefined;

function isImagesBinding(value: unknown): value is ImagesBinding {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { input?: unknown }).input === 'function' &&
		typeof (value as { info?: unknown }).info === 'function'
	);
}

/** Adopts `env.IMAGES` from a Worker invocation; a missing binding leaves `sharp` selected. */
export function installImagesBinding(env: Record<string, unknown> | undefined): boolean {
	const candidate = env?.IMAGES;
	if (!isImagesBinding(candidate)) return false;
	if (candidate !== installedBinding) {
		installedBinding = candidate;
		cloudflareTransformer = undefined;
	}
	return true;
}

/** Forgets the installed binding (tests). */
export function resetImagesBindingForTests(): void {
	installedBinding = undefined;
	cloudflareTransformer = undefined;
}

export async function resolveImageTransformer(): Promise<ImageTransformer> {
	if (installedBinding) {
		if (!cloudflareTransformer) {
			const { createCloudflareImageTransformer } =
				await import('./cloudflare-image-transformer');
			cloudflareTransformer = createCloudflareImageTransformer(installedBinding);
		}
		return cloudflareTransformer;
	}
	if (isCloudflareWorkersRuntime()) {
		throw new Error('The IMAGES binding is not configured for this Worker.');
	}
	const { sharpImageTransformer } = await import('./sharp-image-transformer');
	return sharpImageTransformer;
}
