import { timingSafeEqual } from 'node:crypto';

/**
 * Bearer check for the HTTP cron routes that Vercel invokes. The routes and `CRON_SECRET`
 * leave with the Vercel retirement; the Worker's `scheduled()` calls the job services directly.
 */
export function isAuthorizedCronRequest(request: Request, secret: string): boolean {
	const provided = Buffer.from(request.headers.get('authorization') ?? '');
	const expected = Buffer.from(`Bearer ${secret}`);
	return (
		secret.length > 0 &&
		provided.length === expected.length &&
		timingSafeEqual(provided, expected)
	);
}
