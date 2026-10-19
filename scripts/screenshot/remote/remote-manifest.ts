import type { RemoteRouteCandidate } from './route-inventory.ts';
import type { RemoteTargetKind } from './remote-target.ts';

export const REMOTE_VISUAL_OUTPUT_ROOT = 'output/playwright/remote-visual';
export const REMOTE_MANIFEST_FILE = 'manifest.json';
export const REMOTE_MANIFEST_SCHEMA_VERSION = 1;

export type RemoteViewportName = 'desktop' | 'mobile';

export interface RemoteViewport {
	name: RemoteViewportName;
	width: number;
	height: number;
	isMobile: boolean;
}

export const REMOTE_VIEWPORTS: readonly RemoteViewport[] = [
	{ name: 'desktop', width: 1440, height: 900, isMobile: false },
	{ name: 'mobile', width: 390, height: 844, isMobile: true },
];

export interface RemoteBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A photo or embedded media region in full-page CSS pixels; excluded from the pixel rule. */
export interface RemoteImageRegion {
	kind: 'img' | 'background' | 'embed';
	/** Source name without host, image-service wrapper or build hash. */
	identity: string;
	box: RemoteBox;
	/** `img` only: false when the browser could not decode it. */
	loaded?: boolean;
}

export interface RemoteViewportCapture {
	file: string;
	width: number;
	height: number;
	status: number;
	finalPath: string;
	images: RemoteImageRegion[];
	error?: string;
}

export interface RemoteRouteRecord extends RemoteRouteCandidate {
	/** Status of a plain GET without following redirects. 0 = no answer. */
	status: number;
	location?: string;
	contentType?: string;
	/** `in_progress` definitions the origin does not serve are recorded but not captured. */
	live: boolean;
	asset?: { bytes: number; width?: number; height?: number };
	captures: Partial<Record<RemoteViewportName, RemoteViewportCapture>>;
	error?: string;
}

export interface RemoteCaptureManifest {
	schemaVersion: number;
	label: string;
	origin: string;
	originKind: RemoteTargetKind;
	capturedAt: string;
	/** Browser clock frozen at this instant so countdowns render the same in every set. */
	clock: string;
	viewports: RemoteViewport[];
	routes: RemoteRouteRecord[];
}

export function routeFileStem(path: string): string {
	const stem = path
		.replace(/^\/+|\/+$/g, '')
		.replace(/[^A-Za-z0-9-]+/g, '_')
		.slice(0, 120);
	return stem || 'home';
}

/**
 * Stable identity for an image URL across hosts and image services: the inner source of
 * `/_image?href=` or `/cdn-cgi/image/<options>/`, last path segment,
 * Astro build hash removed.
 */
export function imageIdentity(source: string): string {
	let url: URL;
	try {
		url = new URL(source, 'https://identity.invalid');
	} catch {
		return source;
	}
	const inner = url.searchParams.get('url') ?? url.searchParams.get('href');
	if (inner) return imageIdentity(inner);
	const segments = url.pathname.split('/').filter(Boolean);
	const last = decodeURIComponent(segments.at(-1) ?? '');
	return last.replace(/^(.+?)\.[A-Za-z0-9_-]{8}(\.[A-Za-z0-9]+)$/, '$1$2').toLowerCase();
}

/** Same-origin locations become paths so captures of different hosts stay comparable. */
export function normalizeLocation(location: string, origin: string): string {
	try {
		const url = new URL(location, origin);
		if (url.origin !== origin) return url.toString();
		const path = `${url.pathname}${url.search}`;
		return path.length > 1 ? path.replace(/\/$/, '') : path;
	} catch {
		return location;
	}
}
