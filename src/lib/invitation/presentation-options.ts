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
export * from './xareni-presentation';
