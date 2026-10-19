#!/usr/bin/env tsx
/**
 * Reports, and with `--apply` writes, the WebP width variants of every published R2 image.
 *
 * Images uploaded before width variants existed have none, and `srcset` must not list a variant
 * the bucket does not serve. Without `--apply` this is the read-only gate for turning on
 * `responsiveVariants` for a bucket: it exits 1 while any published image lacks a variant.
 */
import { createHash, randomUUID } from 'node:crypto';
import { flagValue as option } from '../lib/cli-args.ts';
import { ensureResponsiveVariants } from '../provision/r2-adapter.ts';
import { R2_INVITATION_MEDIA } from '../../src/lib/intake/services/r2-invitation-media.ts';
import {
	readPublishedInvitations,
	type MediaVerificationTarget,
} from './verify-published-images.ts';

interface VariantRow {
	route: string;
	asset: string;
	present: number;
	missing: number;
	written: number;
	error?: string;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function readOriginal(url: URL, expectedSha256: string): Promise<Uint8Array> {
	const response = await fetch(`${url.href}?verify=${randomUUID()}`, { redirect: 'error' });
	if (!response.ok) throw new Error(`original delivery failed (HTTP ${response.status})`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (sha256(bytes) !== expectedSha256)
		throw new Error('original bytes do not match their sha256');
	return bytes;
}

export async function runImageVariantBackfill(args: readonly string[]): Promise<VariantRow[]> {
	const target = option(args, '--target');
	if (target !== 'preview' && target !== 'production')
		throw new Error('--target must be preview or production.');
	const slug = option(args, '--slug');
	if (!args.includes('--all') && !slug) throw new Error('Specify --all or --slug <slug>.');
	if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Invalid slug.');
	const apply = args.includes('--apply');
	const origin = R2_INVITATION_MEDIA[target as MediaVerificationTarget].origin;

	const rows: VariantRow[] = [];
	const seen = new Set<string>();
	for (const invitation of readPublishedInvitations(target, slug)) {
		const route = `/${invitation.eventType}/${invitation.slug}`;
		for (const asset of invitation.assets) {
			if (!asset.url || !asset.sha256 || !asset.mimeType?.startsWith('image/')) continue;
			const url = new URL(asset.url);
			if (url.origin !== origin || seen.has(url.pathname)) continue;
			seen.add(url.pathname);
			const row: VariantRow = {
				route,
				asset: asset.key ?? asset.id,
				present: 0,
				missing: 0,
				written: 0,
			};
			try {
				const objectKey = url.pathname.slice(1);
				const report = await ensureResponsiveVariants(
					target,
					objectKey,
					await readOriginal(url, asset.sha256),
					{ dryRun: !apply },
				);
				row.present = report.present.length;
				if (apply) row.written = report.written.length;
				else row.missing = report.written.length;
			} catch (error) {
				row.error = error instanceof Error ? error.message : String(error);
			}
			rows.push(row);
		}
	}
	return rows;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const rows = await runImageVariantBackfill(args);
	const summary = {
		mode: args.includes('--apply') ? 'apply' : 'dry-run',
		images: rows.length,
		complete: rows.filter((row) => !row.error && row.missing === 0).length,
		missingVariants: rows.reduce((total, row) => total + row.missing, 0),
		writtenVariants: rows.reduce((total, row) => total + row.written, 0),
		errors: rows.filter((row) => row.error).length,
	};
	if (args.includes('--json'))
		process.stdout.write(`${JSON.stringify({ summary, rows }, null, 2)}\n`);
	else {
		console.table(rows);
		process.stdout.write(`${JSON.stringify(summary)}\n`);
	}
	if (summary.errors > 0 || summary.missingVariants > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('backfill-image-variants.ts')) {
	main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : 'Variant backfill failed'}\n`,
		);
		process.exitCode = 1;
	});
}
