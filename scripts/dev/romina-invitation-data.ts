/**
 * romina-invitation-data.ts
 *
 * Backward-compatibility re-export module.
 * The canonical single-file definition for Romina lives in:
 *   scripts/provision/invitations/romina-rios-chaparro.ts
 */

export {
	ROMINA_EVENT,
	ROMINA_ASSET_SPECS,
	buildRominaPublishedContent,
	rominaInvitation,
} from '../provision/invitations/romina-rios-chaparro.ts';

export type {
	RominaAssetKey,
	RominaAssetMap,
	UploadedAssetRef,
} from '../provision/invitations/romina-rios-chaparro.ts';
