/**
 * Renders the watermarked bytes of an unpaid preview photo (server-only).
 *
 * Photos keep their original pixel size; only the mark is added, re-encoded at the
 * quality of the managed-asset pipeline. The social variant is a 1200×630 JPEG crop,
 * the size and format link previews expect. Both carry provenance metadata (EXIF and
 * XMP) with an opaque reference to the invitation, never its id or the client's name.
 */
import { createHash } from 'node:crypto';
import { buildPreviewMarkSvg } from './preview-mark-svg';
import type { PreviewMediaVariant } from './preview-media-token';

/** Lazy-load so importers do not require native sharp at module evaluation. */
async function loadSharp() {
	const mod = await import('sharp');
	return mod.default;
}

const MAX_INPUT_PIXELS = 50_000_000;
export const PREVIEW_PHOTO_QUALITY = 84;
const SOCIAL_SIZE = { width: 1200, height: 630 } as const;

export interface RenderedPreviewMedia {
	bytes: Buffer;
	contentType: 'image/webp' | 'image/jpeg';
	width: number;
	height: number;
}

/** Short, non-reversible reference that ties a leaked preview back to its invitation. */
export function previewProvenanceReference(invitationId: string): string {
	return createHash('sha256')
		.update(`celebra-me:preview:${invitationId}`)
		.digest('hex')
		.slice(0, 12);
}

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
}

function buildXmp(reference: string, termsUrl: string): string {
	const rights = 'Vista previa generada por Celebra-me. No autorizada para uso final.';
	return (
		'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
		'<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
		'xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">' +
		`<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(rights)}</rdf:li></rdf:Alt></dc:rights>` +
		`<dc:source>celebra-me-preview:${escapeXml(reference)}</dc:source>` +
		`<xmpRights:WebStatement>${escapeXml(termsUrl)}</xmpRights:WebStatement>` +
		'<xmpRights:Marked>True</xmpRights:Marked>' +
		'</rdf:Description></rdf:RDF></x:xmpmeta>'
	);
}

export async function renderPreviewMedia(input: {
	bytes: Uint8Array;
	variant: PreviewMediaVariant;
	invitationId: string;
	termsUrl: string;
}): Promise<RenderedPreviewMedia> {
	const sharp = await loadSharp();
	const source = sharp(input.bytes, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
	const metadata = await source.metadata();
	const width =
		input.variant === 'og' ? SOCIAL_SIZE.width : (metadata.autoOrient?.width ?? metadata.width);
	const height =
		input.variant === 'og'
			? SOCIAL_SIZE.height
			: (metadata.autoOrient?.height ?? metadata.height);
	if (!width || !height) throw new Error('Preview source has no readable dimensions.');

	const reference = previewProvenanceReference(input.invitationId);
	let pipeline = sharp(input.bytes, {
		failOn: 'error',
		limitInputPixels: MAX_INPUT_PIXELS,
	}).rotate();
	if (input.variant === 'og') {
		pipeline = pipeline.resize(SOCIAL_SIZE.width, SOCIAL_SIZE.height, {
			fit: 'cover',
			position: 'attention',
		});
	}
	pipeline = pipeline
		.composite([
			{ input: Buffer.from(buildPreviewMarkSvg({ width, height })), top: 0, left: 0 },
		])
		.withExif({
			IFD0: {
				Artist: 'Celebra-me',
				Copyright: 'Vista previa generada por Celebra-me. No autorizada para uso final.',
				ImageDescription: `Vista previa · Celebra-me · ref ${reference}`,
			},
		})
		.withXmp(buildXmp(reference, input.termsUrl));

	const bytes =
		input.variant === 'og'
			? await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer()
			: await pipeline.webp({ quality: PREVIEW_PHOTO_QUALITY, effort: 4 }).toBuffer();
	return {
		bytes,
		contentType: input.variant === 'og' ? 'image/jpeg' : 'image/webp',
		width,
		height,
	};
}
