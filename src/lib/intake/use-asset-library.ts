import { useEffect, useState } from 'react';

export interface AssetItem {
	id: string;
	displayName: string;
	src: string;
	isDemo?: boolean;
	demoKey?: string;
	width?: number;
	height?: number;
	fileSize?: number;
	mimeType?: string;
	defaultAltText?: string;
	usage: {
		usedInDraft: boolean;
		usedInPublished: boolean;
		draftSectionRefs: string[];
		publishedSectionRefs: string[];
	};
}

interface UseAssetLibraryResult {
	assets: AssetItem[];
	loading: boolean;
	error: string;
	refresh: () => Promise<void>;
}

function assetUrl(invitationId: string, filter: string): string {
	return `/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets?filter=${encodeURIComponent(filter)}`;
}

async function fetchAssets(
	invitationId: string,
	filter: string,
	signal?: { cancelled: boolean },
): Promise<{ assets: AssetItem[] } | null> {
	const response = await fetch(assetUrl(invitationId, filter));
	const result = await response.json();
	if (!response.ok) {
		throw new Error(result?.error?.message || 'Error al cargar la biblioteca.');
	}
	if (signal?.cancelled) return null;
	return { assets: result.data?.assets ?? result.assets ?? [] };
}

export function useAssetLibrary(invitationId: string, filter = 'active'): UseAssetLibraryResult {
	const [assets, setAssets] = useState<AssetItem[]>([]);
	const [loading, setLoading] = useState(() => Boolean(invitationId));
	const [error, setError] = useState('');

	useEffect(() => {
		if (!invitationId) {
			setAssets([]);
			setLoading(false);
			setError('');
			return;
		}
		const signal = { cancelled: false };
		setLoading(true);
		setError('');

		fetchAssets(invitationId, filter, signal)
			.then((data) => {
				if (data) setAssets(data.assets);
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : 'Error de red.');
			})
			.finally(() => {
				if (!signal.cancelled) setLoading(false);
			});

		return () => {
			signal.cancelled = true;
		};
	}, [filter, invitationId]);

	const refresh = async () => {
		if (!invitationId) return;
		setLoading(true);
		setError('');
		try {
			const data = await fetchAssets(invitationId, filter);
			if (data) setAssets(data.assets);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error de red.');
		} finally {
			setLoading(false);
		}
	};

	return { assets, loading, error, refresh };
}
