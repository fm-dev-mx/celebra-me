import sharpService from 'astro/assets/services/sharp';

/**
 * Image service for `astro dev` only; builds keep the Cloudflare Images binding.
 *
 * Cloudflare Images scales down within a requested width and height when no `fit` is given,
 * preserving the source aspect ratio (a 1024x1536 source asked for 400x400 returns 266x400).
 * Sharp crops to the exact box instead, so dev would render photos the hosted runtime never
 * shows. Defaulting `fit` to `scale-down` keeps dev renders faithful to Production.
 */
const devImageService: typeof sharpService = {
	...sharpService,
	transform(inputBuffer, transform, imageConfig, logger) {
		const hostedFit =
			transform.width && transform.height && !transform.fit
				? { ...transform, fit: 'scale-down' }
				: transform;
		return sharpService.transform(inputBuffer, hostedFit, imageConfig, logger);
	},
};

export default devImageService;
