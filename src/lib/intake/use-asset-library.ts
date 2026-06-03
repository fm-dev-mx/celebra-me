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

export function useAssetLibrary(invitationId: string): UseAssetLibraryResult {
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
		let cancelled = false;
		setLoading(true);
		setError('');

		fetch(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets`)
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result?.error?.message || 'Error al cargar la biblioteca.');
				}
				if (!cancelled) {
					setAssets(result.data?.assets ?? result.assets ?? []);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'Error de red.');
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [invitationId]);

	const refresh = () => {
		if (!invitationId) return Promise.resolve();
		setLoading(true);
		setError('');
		return fetch(`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets`)
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result?.error?.message || 'Error al cargar la biblioteca.');
				}
				setAssets(result.data?.assets ?? result.assets ?? []);
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : 'Error de red.');
			})
			.finally(() => setLoading(false));
	};

	return { assets, loading, error, refresh };
}
