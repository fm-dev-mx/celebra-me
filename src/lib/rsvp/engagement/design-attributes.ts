/**
 * Design attributes captured in permanent invitation engagement snapshots.
 * Source paths: docs/domains/rsvp/engagement-analytics.md (snapshot design attributes).
 * Pure: reads published content only; no guest data.
 */
export const DESIGN_SCHEMA_VERSION = 1;

export interface InvitationDesignAttributes {
	themePreset: string | null;
	fontFamily: string | null;
	templateId: string | null;
	visualProfileId: string | null;
	sections: string[];
	sectionVariants: Record<string, string>;
	personalizedAccessVariant: string | null;
	music: { enabled: boolean; autoPlay: boolean };
	rsvp: { accessMode: string | null; confirmationMode: string | null };
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null;
}

function sectionData(content: Json, key: string): Json | null {
	if (key === 'personalizedAccess') return asObject(asObject(content.rsvp)?.personalizedAccess);
	return asObject(content[key]);
}

export function extractDesignAttributes(content: unknown): InvitationDesignAttributes | null {
	const root = asObject(content);
	if (!root) return null;
	const theme = asObject(root.theme);
	const rsvp = asObject(root.rsvp);
	const music = asObject(root.music);
	const order = Array.isArray(root.sectionOrder)
		? root.sectionOrder.filter((key): key is string => typeof key === 'string')
		: [];
	// A section renders when it is listed and its data is present.
	const sections = order.filter((key) => sectionData(root, key) !== null);
	const sectionVariants: Record<string, string> = {};
	for (const key of sections) {
		const variant = asString(sectionData(root, key)?.variant);
		if (variant) sectionVariants[key] = variant;
	}
	return {
		themePreset: asString(theme?.preset),
		fontFamily: asString(theme?.fontFamily),
		templateId: asString(root.templateId),
		visualProfileId: asString(root.visualProfileId),
		sections,
		sectionVariants,
		personalizedAccessVariant: asString(asObject(rsvp?.personalizedAccess)?.variant),
		music: { enabled: asString(music?.url) !== null, autoPlay: music?.autoPlay === true },
		rsvp: {
			accessMode: asString(rsvp?.accessMode),
			confirmationMode: asString(rsvp?.confirmationMode),
		},
	};
}
