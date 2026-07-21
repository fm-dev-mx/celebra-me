/**
 * invitation-definition.ts — Single-File Invitation Definition Contract
 *
 * Defines the standard typed interface and helper for versioned, single-file
 * invitation definitions in Celebra-me.
 *
 * Invitation definitions contain content structure, asset metadata, timing,
 * and location data, but do NOT contain environment settings, DB queries,
 * credentials, or owner UUIDs.
 */

export interface InvitationAssetSpec {
	key: string;
	fileName: string;
	displayName: string;
	alt: string;
}

export interface UploadedAssetRef {
	type: 'uploaded';
	assetId: string;
	src: string;
}

export type UploadedAssetMap<K extends string = string> = Record<K, UploadedAssetRef>;

export interface InvitationEventTiming {
	localDateTime: string;
	timeZone: string;
	startsAtUtc: string;
}

export interface InvitationDefinition<K extends string = string> {
	slug: string;
	eventType: string;
	title: string;
	clientName: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	photosReceived?: boolean;
	baseDemoId: string;
	themeId: string;
	visualProfileId: string;
	eventTiming: InvitationEventTiming;
	assetSpecs: readonly InvitationAssetSpec[];
	buildPublishedContent(assets: UploadedAssetMap<K>): Record<string, unknown>;
}

/**
 * Type-safe helper for defining single-file invitations.
 */
export function defineInvitation<K extends string = string>(
	definition: InvitationDefinition<K>,
): InvitationDefinition<K> {
	if (!definition.slug || typeof definition.slug !== 'string') {
		throw new Error('Invitation definition requires a non-empty string slug.');
	}
	if (!definition.eventType || typeof definition.eventType !== 'string') {
		throw new Error('Invitation definition requires a non-empty string eventType.');
	}
	if (!definition.title || typeof definition.title !== 'string') {
		throw new Error('Invitation definition requires a non-empty string title.');
	}
	if (!Array.isArray(definition.assetSpecs)) {
		throw new Error('Invitation definition requires an assetSpecs array.');
	}
	if (typeof definition.buildPublishedContent !== 'function') {
		throw new Error('Invitation definition requires a buildPublishedContent function.');
	}
	return definition;
}
