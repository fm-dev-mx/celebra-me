/** Database-only media reference evidence; no remote image delivery is implied. */
export type MediaReferenceEnvironment = 'preview' | 'production';
export type MediaReferenceState = 'MATCH' | 'REFERENCE_DRIFT' | 'MISSING_ASSET' | 'UNVERIFIED';
export type MediaReferenceIssue = 'REFERENCE_DRIFT' | 'MISSING_ASSET';

export interface MediaReferenceFinding {
	route: string;
	slug: string;
	path: string;
	assetKey: string;
	issue: MediaReferenceIssue;
}

export interface MediaReferenceEnvironmentStatus {
	status: MediaReferenceState;
	invitations: number;
	references: number;
	findings: MediaReferenceFinding[];
}

export type MediaReferencesStatus = Record<
	MediaReferenceEnvironment,
	MediaReferenceEnvironmentStatus | null
>;
