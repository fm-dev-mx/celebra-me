import sanitizeHtml from 'sanitize-html';

const INDICATION_HTML_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ['strong', 'br', 'a'],
	// Links carry only an https href; target/rel are set by the transform below.
	allowedAttributes: { a: ['href', 'target', 'rel'] },
	allowedSchemes: ['https'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard',
	transformTags: {
		// Non-https links become a disallowed tag, so their text stays and the link is dropped.
		a: (_tagName, attribs): sanitizeHtml.Tag => {
			const href = attribs.href;
			if (!href?.trim().toLowerCase().startsWith('https://'))
				return { tagName: 'span', attribs: {} };
			return {
				tagName: 'a',
				attribs: { href: href.trim(), target: '_blank', rel: 'noopener noreferrer' },
			};
		},
	},
};

/**
 * Sanitizes the limited rich text supported by location indications before it
 * is inserted into invitation HTML. Newlines remain visible as line breaks; links
 * are allowed only with an https href and always open in a new tab.
 */
export function sanitizeIndicationHtml(value: string): string {
	return sanitizeHtml(value.replace(/\r\n?|\n/gu, '<br>'), INDICATION_HTML_OPTIONS);
}
