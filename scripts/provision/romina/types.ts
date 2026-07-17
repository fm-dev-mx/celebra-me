import type {
	RominaAssetKey,
	RominaAssetMap,
} from '../../dev/romina-invitation-data';

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Database types — precise minimal subset matching the GenericSchema contract
// so the Supabase client can infer table names and RPC signatures.
// ---------------------------------------------------------------------------

type RS = Record<string, unknown>;

/** The publish_invitation_atomic RPC returns a JSONB object with this shape. */
export interface PublicationRpcReturn {
	draft: {
		id: string;
		invitationId: string;
		submissionId: string | null;
		content: RS;
		status: string;
		createdAt: string;
		updatedAt: string;
	};
	publishedContent: {
		id: string;
		slug: string;
		eventType: string;
		version: number;
		publishedAt: string;
	};
}

export interface Database {
	public: {
		Tables: {
			invitations: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
			invitation_assets: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
			invitation_content_drafts: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
			events: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
			event_memberships: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
			published_invitation_content: { Row: RS; Insert: RS; Update: RS; Relationships: [] };
		};
		Views: Record<string, never>;
		Functions: {
			publish_invitation_atomic: {
				Args: Record<string, unknown>;
				Returns: PublicationRpcReturn;
			};
		};
	};
}

export type DbClient = ReturnType<typeof createClient<Database>>;

// ---------------------------------------------------------------------------
// Application types
// ---------------------------------------------------------------------------

export interface StoredAsset {
	id: string;
	displayName: string;
	storagePath: string;
	fileSize: number;
	width: number;
	height: number;
	/** SHA-256 hex digest of the stored object's image bytes (computed at provision time). */
	imageHash: string | null;
}

export interface NormalizedOutput {
	key: RominaAssetKey;
	bytes: Uint8Array;
	fileName: string;
	displayName: string;
	alt: string;
	width: number;
	height: number;
	fileSize: number;
	mimeType: string;
	originalMimeType: string;
	originalFileSize: number;
	/** SHA-256 hex digest of normalized image bytes. */
	imageHash: string;
}

export type AssetStatus = 'missing' | 'identical' | 'changed' | 'duplicate' | 'conflicting';

export interface AssetAction {
	resource: string;
	action: 'create' | 'reuse' | 'replace' | 'skip' | 'abort';
	status: AssetStatus;
	detail: string;
}

export interface PhaseAction {
	resource: string;
	action: 'create' | 'reuse' | 'replace' | 'skip' | 'abort';
	detail: string;
}

export interface CreatedResources {
	storagePaths: string[];
	assetRowIds: string[];
}

export interface CliArgs {
	mode: 'dry-run' | 'apply';
	ownerUserId: string;
	sourceDir: string;
}

export interface ApplyContext {
	supabase: DbClient;
	supabaseUrl: string;
	serviceRoleKey: string;
	invitationId: string;
	normalized: NormalizedOutput[];
	assetActions: AssetAction[];
	assetMap: RominaAssetMap;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BUCKET = 'invitation-assets';
export const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
