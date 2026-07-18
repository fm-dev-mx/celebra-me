// Disposable service-flow tests import application modules directly, outside
// Astro/Vite. Static event assets are irrelevant to this backend exercise.
export async function resolve(specifier, context, nextResolve) {
	if (specifier === 'astro:content') return { url: 'astro:content', shortCircuit: true };
	if (specifier === '@/lib/assets/asset-registry')
		return { url: 'test:asset-registry', shortCircuit: true };
	if (specifier === '@/lib/schemas/content/base-event.schema')
		return { url: 'test:event-content-schema', shortCircuit: true };
	return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
	if (url === 'astro:content') {
		return {
			format: 'module',
			shortCircuit: true,
			source: "import demo from 'file:///D:/code/celebra-me/src/content/event-demos/xv/demo-xv-jewelry-box.json' with { type: 'json' }; export async function getCollection() { return [{ id: 'xv/demo-xv-jewelry-box', data: demo }]; }",
		};
	}
	if (url === 'test:asset-registry') {
		return {
			format: 'module',
			shortCircuit: true,
			source: 'export const isValidEvent = () => true; export const getEventAsset = () => ({ src: "/test-asset.webp" }); export const isEventAssetKey = () => false; export const ALL_ASSET_KEYS = []; export const EVENT_KEYS = []; export const COMMON_KEYS = []; export const ImageRegistry = { events: {}, common: {} }; export const getCommonAsset = () => ({ src: "/test-asset.webp", alt: "" }); export const isCommonAssetKey = () => false; export const isAssetRegistryKey = () => false;',
		};
	}
	if (url === 'test:event-content-schema') {
		return {
			format: 'module',
			shortCircuit: true,
			source: 'export const eventContentSchema = { safeParse: (data) => ({ success: true, data }) };',
		};
	}
	if (url.endsWith('/src/lib/assets/asset-registry.ts')) {
		return {
			format: 'module',
			shortCircuit: true,
			source: 'export const isValidEvent = () => true; export const getEventAsset = () => ({ src: "/test-asset.webp" }); export const isEventAssetKey = () => false; export const ALL_ASSET_KEYS = []; export const EVENT_KEYS = []; export const COMMON_KEYS = []; export const ImageRegistry = { events: {}, common: {} }; export const getCommonAsset = () => ({ src: "/test-asset.webp", alt: "" }); export const isCommonAssetKey = () => false; export const isAssetRegistryKey = () => false;',
		};
	}
	if (url.endsWith('/src/lib/schemas/content/base-event.schema.ts')) {
		return {
			format: 'module',
			shortCircuit: true,
			source: 'export const eventContentSchema = { safeParse: (data) => ({ success: true, data }) };',
		};
	}
	if (/\.(png|jpe?g|gif|webp|svg)$/i.test(url)) {
		return { format: 'module', shortCircuit: true, source: 'export default "";' };
	}
	return nextLoad(url, context);
}
