import {
	runPublishedImageVerification,
	verifyPublishedInvitation,
	type ExpectedImage,
	type PublishedInvitation,
} from './verify-published-images.ts';

export async function verifyPublishedImageManifest(
	expected: readonly ExpectedImage[],
	published: PublishedInvitation,
	download: typeof fetch = fetch,
): Promise<string[]> {
	const normalized: PublishedInvitation = {
		eventType: published.eventType ?? 'unknown',
		slug: published.slug ?? 'unknown',
		content: published.content,
		assets: published.assets,
	};
	const rows = await verifyPublishedInvitation(normalized, expected, download);
	return rows.flatMap((row) => row.reasons.map((reason) => `${row.assetKey}: ${reason}`)).sort();
}

async function main(): Promise<void> {
	const requested = process.argv[2];
	if (requested !== '--all' && !requested?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))
		throw new Error('Usage: tsx scripts/invitation/verify-preview-images.ts <slug|--all>');
	const args =
		requested === '--all'
			? ['--target', 'preview', '--all']
			: ['--target', 'preview', '--slug', requested!];
	const result = await runPublishedImageVerification(args);
	const failures = result.rows.filter((row) => row.classification !== 'HEALTHY');
	if (failures.length)
		throw new Error(
			`Preview image verification failed:\n${failures.map((row) => `${row.route}/${row.assetKey}: ${row.reasons.join('; ')}`).join('\n')}`,
		);
	process.stdout.write(
		`${new Set(result.rows.map((row) => row.route)).size} invitations verified.\n`,
	);
}
if (process.argv[1]?.endsWith('verify-preview-images.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : 'Preview image verification failed'}\n`,
		);
		process.exitCode = 1;
	});
}
