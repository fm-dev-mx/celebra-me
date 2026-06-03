import { findDraftByInvitationId } from '@/lib/intake/repositories/invitation-content-draft.repository';
import { findPublishedByInvitationId } from '@/lib/intake/repositories/published-invitation-content.repository';
import { UUID_PATTERN } from '@/lib/intake/constants';

export interface AssetUsageEntry {
	section: string;
	path: string;
}

export interface AssetUsage {
	assetId: string;
	usedInDraft: boolean;
	usedInPublished: boolean;
	draftRefs: AssetUsageEntry[];
	publishedRefs: AssetUsageEntry[];
}

function extractSection(path: string): string {
	return path.split('.')[0];
}

function collectAllAssetRefs(
	value: unknown,
	path: string,
	results: Map<string, AssetUsageEntry[]>,
): void {
	if (!value || typeof value !== 'object') return;

	const obj = value as Record<string, unknown>;

	if (obj.type === 'uploaded' && typeof obj.assetId === 'string') {
		const section = extractSection(path);
		const entry: AssetUsageEntry = { section, path };
		const entries = results.get(obj.assetId);
		if (entries) {
			entries.push(entry);
		} else {
			results.set(obj.assetId, [entry]);
		}
		return;
	}

	for (const [key, child] of Object.entries(obj)) {
		const childPath = path ? `${path}.${key}` : key;
		if (typeof child === 'object' && child !== null) {
			collectAllAssetRefs(child, childPath, results);
		} else if (typeof child === 'string' && UUID_PATTERN.test(child)) {
			const section = extractSection(childPath);
			const entry: AssetUsageEntry = { section, path: childPath };
			const entries = results.get(child);
			if (entries) {
				entries.push(entry);
			} else {
				results.set(child, [entry]);
			}
		}
	}
}

function buildUsagesFromRefs(
	content: Record<string, unknown> | null | undefined,
	toDraft: boolean,
	usageMap: Map<string, AssetUsage>,
): void {
	if (!content) return;
	const contentRefs = new Map<string, AssetUsageEntry[]>();
	collectAllAssetRefs(content, '', contentRefs);

	for (const [assetId, entries] of contentRefs) {
		let usage = usageMap.get(assetId);
		if (!usage) {
			usage = {
				assetId,
				usedInDraft: false,
				usedInPublished: false,
				draftRefs: [],
				publishedRefs: [],
			};
			usageMap.set(assetId, usage);
		}
		if (toDraft) {
			usage.usedInDraft = true;
			usage.draftRefs = entries;
		} else {
			usage.usedInPublished = true;
			usage.publishedRefs = entries;
		}
	}
}

export async function collectAssetUsagesByInvitation(
	invitationId: string,
	assetId?: string,
): Promise<AssetUsage[]> {
	const [draft, published] = await Promise.all([
		findDraftByInvitationId(invitationId),
		findPublishedByInvitationId(invitationId),
	]);

	const draftContent = draft?.content as Record<string, unknown> | undefined;
	const publishedContent = published?.content as Record<string, unknown> | undefined;

	const usageMap = new Map<string, AssetUsage>();
	buildUsagesFromRefs(draftContent, true, usageMap);
	buildUsagesFromRefs(publishedContent, false, usageMap);

	if (assetId) {
		return [
			usageMap.get(assetId) ?? {
				assetId,
				usedInDraft: false,
				usedInPublished: false,
				draftRefs: [],
				publishedRefs: [],
			},
		];
	}

	return Array.from(usageMap.values());
}

export async function collectAssetUsage(
	invitationId: string,
	assetId: string,
): Promise<AssetUsage> {
	const usages = await collectAssetUsagesByInvitation(invitationId, assetId);
	return (
		usages[0] ?? {
			assetId,
			usedInDraft: false,
			usedInPublished: false,
			draftRefs: [],
			publishedRefs: [],
		}
	);
}
