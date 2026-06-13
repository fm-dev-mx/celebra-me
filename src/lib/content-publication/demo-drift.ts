import { getCollection } from 'astro:content';
import { getContentEntrySlug } from '@/lib/content/events';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	listPublishedByEventTypes,
	type PublishedInvitationContent,
} from '@/lib/intake/repositories/published-invitation-content.repository';
import { hashContent } from '@/lib/content-publication/hash-content';
import { diffContent, type DiffExample } from '@/lib/content-publication/diff-content';
import {
	classifyDemoDriftStatus,
	type DemoDriftStatus,
} from '@/lib/content-publication/drift-status';
import { routeKey } from '@/lib/content-publication/_utils';

export type SourceEnvironment = 'production' | 'preview' | 'local' | 'unknown';

export interface DemoDriftItem {
	event_type: string;
	slug: string;
	route_key: string;
	published_row_id: string | null;
	is_demo: boolean | null;
	status: DemoDriftStatus;
	local_hash: string | null;
	prod_hash: string | null;
	changed_paths: string[];
	diff_examples: DiffExample[];
}

export interface DemoDriftReport {
	generated_at: string;
	scope: 'demos';
	source_environment: SourceEnvironment;
	target_environment: 'production';
	summary: Record<DemoDriftStatus, number>;
	items: DemoDriftItem[];
}

type LocalDemoMap = Record<string, Record<string, unknown>>;

const STATUS_ORDER: DemoDriftStatus[] = [
	'in_sync',
	'different',
	'missing_in_prod',
	'missing_locally',
	'schema_mismatch',
	'unsafe_target',
];

function summarize(items: DemoDriftItem[]): Record<DemoDriftStatus, number> {
	const summary = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<
		DemoDriftStatus,
		number
	>;
	for (const item of items) summary[item.status] += 1;
	return summary;
}

export function resolveSourceEnvironment(): SourceEnvironment {
	if (typeof process !== 'undefined') {
		if (process.env?.VERCEL_ENV === 'production') return 'production';
		if (process.env?.VERCEL_ENV === 'preview') return 'preview';
		if (process.env?.NODE_ENV === 'development') return 'local';
	}
	return 'unknown';
}

export async function loadCanonicalDemoContent(): Promise<LocalDemoMap> {
	const entries = await getCollection('event-demos');
	const result: LocalDemoMap = {};
	for (const entry of entries) {
		const eventType = String(entry.data.eventType || '').trim();
		const slug = getContentEntrySlug(entry.id);
		result[routeKey(eventType, slug)] = entry.data as Record<string, unknown>;
	}
	return result;
}

export function validateLocalContent(
	content: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
	if (!content) return null;
	const parsed = eventContentSchema.safeParse(content);
	if (!parsed.success) return null;
	return parsed.data as Record<string, unknown>;
}

function publishedMap(rows: PublishedInvitationContent[]): Map<string, PublishedInvitationContent> {
	const map = new Map<string, PublishedInvitationContent>();
	for (const row of rows) {
		map.set(routeKey(row.eventType, row.slug), row);
	}
	return map;
}

function buildItem(params: {
	eventType: string;
	slug: string;
	localContent?: Record<string, unknown>;
	prodRow?: PublishedInvitationContent;
}): DemoDriftItem {
	const local = validateLocalContent(params.localContent);
	const prod = params.prodRow;
	const localHash = local ? hashContent(local) : null;
	const prodHash = prod ? hashContent(prod.content) : null;
	const status = classifyDemoDriftStatus({
		hasLocal: !!params.localContent,
		hasProd: !!prod,
		localValid: params.localContent ? !!local : undefined,
		prodIsDemo: prod?.isDemo ?? null,
		localHash,
		prodHash,
	});
	const diff =
		local && prod?.content && status !== 'unsafe_target'
			? diffContent(prod.content, local)
			: { changedPaths: [], examples: [] };

	return {
		event_type: params.eventType,
		slug: params.slug,
		route_key: routeKey(params.eventType, params.slug),
		published_row_id: prod?.id ?? null,
		is_demo: prod?.isDemo ?? null,
		status,
		local_hash: localHash,
		prod_hash: prodHash,
		changed_paths: diff.changedPaths,
		diff_examples: diff.examples,
	};
}

export async function buildDemoDriftReport(
	options: {
		loadLocalDemos?: () => Promise<LocalDemoMap>;
		loadPublishedRows?: () => Promise<PublishedInvitationContent[]>;
		sourceEnvironment?: SourceEnvironment;
	} = {},
): Promise<DemoDriftReport> {
	const localDemos = await (options.loadLocalDemos ?? loadCanonicalDemoContent)();
	const localEventTypes = [...new Set(Object.keys(localDemos).map((key) => key.split('/')[0]))];
	const publishedRows = await (
		options.loadPublishedRows ?? (() => listPublishedByEventTypes(localEventTypes))
	)();
	const prodByKey = publishedMap(publishedRows);
	const keys = new Set([...Object.keys(localDemos), ...prodByKey.keys()]);

	const items = [...keys]
		.sort((a, b) => a.localeCompare(b))
		.map((key) => {
			const [eventType = '', slug = ''] = key.split('/');
			return buildItem({
				eventType,
				slug,
				localContent: localDemos[key],
				prodRow: prodByKey.get(key),
			});
		});

	return {
		generated_at: new Date().toISOString(),
		scope: 'demos',
		source_environment: options.sourceEnvironment ?? resolveSourceEnvironment(),
		target_environment: 'production',
		summary: summarize(items),
		items,
	};
}
