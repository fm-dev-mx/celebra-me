/**
 * Download response for a space's printable QR, shared by the admin and host
 * routes. The SVG only encodes the public URL already printed for guests; it is
 * still served behind a session so the routes cannot enumerate events.
 */

import type { MemoriesSpaceRecord } from '@/lib/memories/contract/catalog';
import { buildMemoriesPublicUrl } from '@/lib/memories/contract/private-request';
import { buildMemoriesQrFileName, generateMemoriesQrSvg } from '@/lib/memories/qr';
import { withPrivateCache } from '@/lib/rsvp/core/http';

export async function buildMemoriesQrDownloadResponse(
	space: Pick<MemoriesSpaceRecord, 'publicSlug'>,
): Promise<Response> {
	const svg = await generateMemoriesQrSvg(buildMemoriesPublicUrl(space.publicSlug));
	return withPrivateCache(
		new Response(svg, {
			status: 200,
			headers: {
				'Content-Type': 'image/svg+xml; charset=utf-8',
				'Content-Disposition': `attachment; filename="${buildMemoriesQrFileName(space.publicSlug)}"`,
				'X-Content-Type-Options': 'nosniff',
			},
		}),
	);
}
