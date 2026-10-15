/**
 * Renders the watermarked bytes of an unpaid preview photo (server-only).
 *
 * Photos keep their original pixel size; only the mark is added, re-encoded at the
 * quality of the managed-asset pipeline. The social variant is a 1200×630 JPEG crop,
 * the size and format link previews expect. Both carry provenance metadata (EXIF and
 * XMP) with an opaque reference to the invitation, never its id or the client's name.
 */
import { resolveImageTransformer } from '@/lib/images/image-transformer-provider';
import { invitationProvenanceReference } from './provenance';
import type { PreviewMediaVariant } from './preview-media-token';

const MAX_INPUT_PIXELS = 50_000_000;
const PREVIEW_PHOTO_QUALITY = 84;
const SOCIAL_QUALITY = 80;
const SOCIAL_SIZE = { width: 1200, height: 630 } as const;

export interface RenderedPreviewMedia {
	bytes: Uint8Array;
	contentType: 'image/webp' | 'image/jpeg';
	width: number;
	height: number;
}

/** Short, non-reversible reference that ties a leaked preview back to its invitation. */
export const previewProvenanceReference = invitationProvenanceReference;

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
	const transformer = await resolveImageTransformer();
	const reference = previewProvenanceReference(input.invitationId);
	const isSocial = input.variant === 'og';
	const marked = await transformer.renderMarked({
		bytes: input.bytes,
		limitInputPixels: MAX_INPUT_PIXELS,
		crop: isSocial ? SOCIAL_SIZE : undefined,
		format: isSocial ? 'jpeg' : 'webp',
		quality: isSocial ? SOCIAL_QUALITY : PREVIEW_PHOTO_QUALITY,
		provenance: {
			exif: {
				artist: 'Celebra-me',
				copyright: 'Vista previa generada por Celebra-me. No autorizada para uso final.',
				description: `Vista previa · Celebra-me · ref ${reference}`,
			},
			xmp: buildXmp(reference, input.termsUrl),
		},
	});
	return {
		bytes: marked.data,
		contentType: isSocial ? 'image/jpeg' : 'image/webp',
		width: marked.width,
		height: marked.height,
	};
}
