/**
 * Pure environment attribution for the platform console: which panel
 * environments exist and which R2 bucket belongs to which one. No imports
 * beyond the sibling contract types.
 *
 * Bucket naming convention (verified in the worker wrangler configs and the
 * `docs/env-workflow.md` cheatsheet): the un-suffixed bucket is Production,
 * `-staging` / `-preview` is Preview, and `-local` is the local development
 * bucket, which the panel never shows as its own line.
 */

import type { PlatformEnvironmentId } from './types';

export type R2BucketEnvironment = PlatformEnvironmentId | 'local';

export function classifyR2BucketEnvironment(bucketName: string): R2BucketEnvironment {
	if (/-local$/i.test(bucketName)) return 'local';
	if (/(?:-staging|-preview)$/i.test(bucketName)) return 'preview';
	if (/(?:-production|-prod)$/i.test(bucketName)) return 'production';
	// The un-suffixed name is the Production binding by the repository convention.
	return 'production';
}

/**
 * Resolve the bucket of one environment from the observed bucket names, used
 * only when Local has no explicit `*_PREVIEW` / `*_PRODUCTION` value. An
 * ambiguous match resolves to null rather than guessing.
 */
export function matchR2BucketForEnvironment(
	bucketNames: Iterable<string>,
	environment: PlatformEnvironmentId,
): string | null {
	const matches = Array.from(bucketNames).filter(
		(name) => classifyR2BucketEnvironment(name) === environment,
	);
	return matches.length === 1 ? matches[0] : null;
}
