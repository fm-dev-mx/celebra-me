import sanitizeHtml from 'sanitize-html';

const INDICATION_HTML_OPTIONS = {
	allowedTags: ['strong', 'br'],
	allowedAttributes: {},
	disallowedTagsMode: 'discard' as const,
};

/**
 * Sanitizes the limited rich text supported by location indications before it
 * is inserted into invitation HTML. Newlines remain visible as line breaks.
 */
export function sanitizeIndicationHtml(value: string): string {
	return sanitizeHtml(value.replace(/\r\n?|\n/gu, '<br>'), INDICATION_HTML_OPTIONS);
}
