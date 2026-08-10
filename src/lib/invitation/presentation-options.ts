// Compatibility surface for existing schema, editor, adapter, and integration imports.
// Section implementations live in their owning modules; legacy Location handling is kept
// in the compatibility boundary below.
export * from './family-presentation';
export * from './hero-presentation';
export * from './itinerary-presentation';
export * from './countdown-presentation';
export * from './gallery-presentation';
export * from './gifts-presentation';
export {
	LOCATION_PRESENTATIONS,
	resolveLocationMediaMode,
	type LocationMediaMode,
	type LocationPresentation,
} from './location-presentation';
export type { LocationPresentationOptions } from './location-presentation';
export {
	detectShowFlourishesConflict,
	foldLocationPresentationOptions,
	resolveLocationShowFlourishes,
	resolveLocationShowNavigationButtons,
} from './location-presentation-compatibility';

// Legacy Xareni exports remain available from their canonical Envelope,
// editor-metadata, asset-identity, and profile-token owners.
export {
	ENVELOPE_SEAL_COLORS as XARENI_SEAL_COLORS,
	isEnvelopeSealColor as isXareniSealColor,
	type EnvelopeSealColor as XareniSealColor,
} from './reveal-card';
export { resolveXareniSealColor } from './invitation-profile-css';
export { XARENI_ASSET_SLUG } from '@/lib/assets/asset-keys';
export {
	ENVELOPE_SEAL_COLOR_LABELS as XARENI_SEAL_COLOR_LABELS,
	supportsXareniPresentationOptions,
} from '@/lib/intake/labels';
