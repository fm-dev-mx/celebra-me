import { useEffect, useState, useCallback } from 'react';

export interface AssetItem {
	id: string;
	displayName: string;
	src: string;
	usage: {
		usedInDraft: boolean;
		usedInPublished: boolean;
		draftSectionRefs?: string[];
		publishedSectionRefs?: string[];
	};
}

interface UseAssetLibraryResult {
	assets: AssetItem[];
	loading: boolean;
	error: string;
	refresh: () => Promise<void>;
}

export function useAssetLibrary(invitationId: string): UseAssetLibraryResult {
	const [assets, setAssets] = useState<AssetItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchAssets = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets`,
			);
			const result = await response.json();
			if (!response.ok) {
				throw new Error(result?.error?.message || 'Error al cargar la biblioteca.');
			}
			setAssets(result.data?.assets ?? result.assets ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error de red.');
		} finally {
			setLoading(false);
		}
	}, [invitationId]);

	useEffect(() => {
		fetchAssets();
	}, [fetchAssets]);

	return { assets, loading, error, refresh: fetchAssets };
}
