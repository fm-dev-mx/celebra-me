import { readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/**
 * Remote route inventory: every public route a guest or prospect can reach on a live origin.
 * Candidates come from the repository (definitions, demos, showrooms, redirects); the live probe
 * then decides which authoring definitions are actually served.
 */
type RemoteRouteKind = 'page' | 'redirect' | 'asset';
type RemoteRouteGroup =
	'site' | 'showroom' | 'demo' | 'invitation' | 'memories' | 'redirect' | 'preview-photo';

export interface RemoteRouteCandidate {
	path: string;
	kind: RemoteRouteKind;
	group: RemoteRouteGroup;
	/** `in_progress` definitions are captured only when the origin serves them. */
	lifecycle?: 'published' | 'in_progress';
	/** Redirects: the path the origin must answer with, permanently. */
	expectedLocation?: string;
	/** Assets: the media type the origin must answer with. */
	expectedContentType?: string;
}

interface RouteDefinitionSource {
	eventType: string;
	slug: string;
	lifecycle: 'published' | 'in_progress';
}

interface RedirectRuleSource {
	source: string;
	destination: string;
	permanent?: boolean;
}

export interface RouteSources {
	definitions: RouteDefinitionSource[];
	demos: Array<{ eventType: string; slug: string }>;
	showroomPaths: string[];
	redirects: RedirectRuleSource[];
	memoriesPaths: string[];
}

const SITE_PATHS = ['/', '/login', '/privacidad', '/terminos'] as const;
/** QR landing of the one invitation with the memories add-on in Production. */
const MEMORIES_PATHS = ['/r/victoria-y-roberto'] as const;

function instantiateRedirect(
	rule: RedirectRuleSource,
	sample: RouteDefinitionSource | undefined,
): { source: string; destination: string } | undefined {
	const params: Record<string, string> = sample
		? { eventType: sample.eventType, slug: sample.slug }
		: {};
	const fill = (pattern: string): string | undefined => {
		let missing = false;
		const filled = pattern.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
			const value = params[name];
			if (!value) missing = true;
			return value ?? '';
		});
		return missing ? undefined : filled;
	};
	const source = fill(rule.source);
	const destination = fill(rule.destination);
	return source && destination ? { source, destination } : undefined;
}

export function buildRouteCandidates(sources: RouteSources): RemoteRouteCandidate[] {
	const routes: RemoteRouteCandidate[] = [];
	const seen = new Set<string>();
	const add = (route: RemoteRouteCandidate) => {
		if (seen.has(route.path)) return;
		seen.add(route.path);
		routes.push(route);
	};

	for (const path of SITE_PATHS) add({ path, kind: 'page', group: 'site' });
	for (const path of sources.showroomPaths) add({ path, kind: 'page', group: 'showroom' });
	for (const demo of sources.demos) {
		add({ path: `/${demo.eventType}/${demo.slug}`, kind: 'page', group: 'demo' });
	}
	const definitions = [...sources.definitions].sort((a, b) =>
		`${a.eventType}/${a.slug}`.localeCompare(`${b.eventType}/${b.slug}`),
	);
	for (const definition of definitions) {
		add({
			path: `/${definition.eventType}/${definition.slug}`,
			kind: 'page',
			group: 'invitation',
			lifecycle: definition.lifecycle,
		});
	}
	for (const path of sources.memoriesPaths) add({ path, kind: 'page', group: 'memories' });

	const sample = definitions.find((definition) => definition.lifecycle === 'published');
	for (const rule of sources.redirects) {
		if (rule.permanent === false) continue;
		const instance = instantiateRedirect(rule, sample);
		if (!instance) continue;
		add({
			path: instance.source,
			kind: 'redirect',
			group: 'redirect',
			expectedLocation: instance.destination,
		});
	}
	return routes;
}

/** Repository sources at `root`. Imported lazily so unit tests can stay hermetic. */
export async function loadRepositoryRouteSources(root: string): Promise<RouteSources> {
	const [{ listActiveInvitationDefinitions }, { DEMO_SHOWROOM_EVENTS }, { PERMANENT_REDIRECTS }] =
		await Promise.all([
			import('../../provision/invitations/registry.ts'),
			import('../../../src/data/demo-showroom.data.ts'),
			import('../../../src/lib/server/security-headers.ts'),
		]);
	const demosRoot = resolve(root, 'src/content/event-demos');
	const demos = readdirSync(demosRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) =>
			readdirSync(join(demosRoot, entry.name))
				.filter((file) => file.endsWith('.json'))
				.map((file) => ({ eventType: entry.name, slug: basename(file, '.json') })),
		)
		.sort((a, b) => `${a.eventType}/${a.slug}`.localeCompare(`${b.eventType}/${b.slug}`));
	return {
		definitions: listActiveInvitationDefinitions().map((definition) => ({
			eventType: definition.eventType,
			slug: definition.slug,
			lifecycle: definition.lifecycle,
		})),
		demos,
		showroomPaths: DEMO_SHOWROOM_EVENTS.map((event) => event.showroomHref),
		redirects: PERMANENT_REDIRECTS.map((rule) => ({ ...rule, permanent: true })),
		memoriesPaths: [...MEMORIES_PATHS],
	};
}
