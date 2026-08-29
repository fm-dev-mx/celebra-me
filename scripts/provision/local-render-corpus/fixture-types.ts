/** Versioned, sanitized content source used to author a canonical definition. */
export interface LocalRenderCorpusFixture {
	schemaVersion: 1;
	slug: string;
	eventType: string;
	title: string;
	themeId: string;
	baseDemoId: string;
	/** Public-render snapshot fields only (previewSlug / theme pairing). */
	snapshot: {
		previewSlug: string;
		[key: string]: unknown;
	};
	/** Render-effective published content (no guests/auth/RSVP operational tables). */
	publishedContent: Record<string, unknown>;
	notes?: string;
}
