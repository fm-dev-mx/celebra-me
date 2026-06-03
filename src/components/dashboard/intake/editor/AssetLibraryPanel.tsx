import { useState } from 'react';
import AssetUploader from '@/components/dashboard/intake/editor/AssetUploader';
import { getCsrfToken } from '@/lib/csrf';
import { useAssetLibrary, type AssetItem } from '@/lib/intake/use-asset-library';
import {
	getAssetUsageLabel,
	EMPTY_ASSET_LIBRARY_COPY,
	DEMO_ASSET_LABEL,
	ASSET_EDIT_LABEL,
	ASSET_SAVE_LABEL,
	ASSET_CANCEL_LABEL,
	ASSET_ALT_TEXT_LABEL,
	ASSET_ALT_SAVE_LABEL,
	ASSET_SECTION_REFS_HEADER,
	ARCHIVED_TAB_LABEL,
	ACTIVE_TAB_LABEL,
	RESTORE_LABEL,
	ARCHIVED_DATE_LABEL,
	ARCHIVED_HELP_LABEL,
} from '@/lib/intake/labels';

interface Props {
	invitationId: string;
}

function buildConflictMessage(
	details: { sectionRefs?: string[] } | undefined,
	fallback: string,
): string {
	const refs = details?.sectionRefs?.filter(Boolean) ?? [];
	if (refs.length === 0) return fallback;
	return [
		'No se puede eliminar esta imagen porque está siendo utilizada.',
		`Usos detectados: ${refs.join(', ')}.`,
		'Primero quítala de esas secciones y vuelve a intentarlo.',
	].join('\n');
}

function AssetSectionRefs({ refs }: { refs: string[] }) {
	if (refs.length === 0) return null;

	return (
		<details className="asset-library__refs">
			<summary className="asset-library__refs-summary">{ASSET_SECTION_REFS_HEADER}</summary>
			<ul className="asset-library__refs-list">
				{refs.map((ref) => (
					<li key={ref} className="asset-library__refs-item">
						{ref}
					</li>
				))}
			</ul>
		</details>
	);
}

function InlineEditField({
	value,
	onSave,
	buttonLabel,
	inputLabel,
}: {
	value: string;
	onSave: (newValue: string) => Promise<void>;
	buttonLabel: string;
	inputLabel: string;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [saving, setSaving] = useState(false);
	const [editError, setEditError] = useState('');

	if (!editing) {
		return (
			<button
				type="button"
				className="asset-library__edit-btn"
				onClick={() => {
					setDraft(value);
					setEditing(true);
					setEditError('');
				}}
				aria-label={`${buttonLabel}: ${value}`}
			>
				{value || inputLabel}
			</button>
		);
	}

	return (
		<span className="asset-library__edit-inline">
			<label className="asset-library__edit-label">
				<span className="asset-library__sr-only">{inputLabel}</span>
				<input
					type="text"
					className="asset-library__edit-input"
					value={draft}
					onChange={(e) => {
						setDraft(e.target.value);
						setEditError('');
					}}
					disabled={saving}
					autoFocus
				/>
			</label>
			<button
				type="button"
				className="asset-library__edit-save"
				disabled={saving || draft === value}
				onClick={async () => {
					setSaving(true);
					setEditError('');
					try {
						await onSave(draft);
						setEditing(false);
					} catch (err) {
						setEditError(err instanceof Error ? err.message : 'Error al guardar.');
					} finally {
						setSaving(false);
					}
				}}
			>
				{ASSET_SAVE_LABEL}
			</button>
			<button
				type="button"
				className="asset-library__edit-cancel"
				disabled={saving}
				onClick={() => setEditing(false)}
			>
				{ASSET_CANCEL_LABEL}
			</button>
			{editError && (
				<span className="asset-library__edit-error" role="alert">
					{editError}
				</span>
			)}
		</span>
	);
}

function AssetNameSection({
	asset,
	filter,
	onRename,
	onEditAltText,
}: {
	asset: AssetItem;
	filter: 'active' | 'archived';
	onRename: (assetId: string, newName: string) => Promise<void>;
	onEditAltText: (assetId: string, newAltText: string) => Promise<void>;
}) {
	const isDemo = asset.isDemo ?? false;
	if (isDemo || filter === 'archived') {
		return <span className="asset-library__name">{asset.displayName}</span>;
	}
	return (
		<>
			<InlineEditField
				value={asset.displayName}
				onSave={(v) => onRename(asset.id, v)}
				buttonLabel={ASSET_EDIT_LABEL}
				inputLabel="Nombre visible"
			/>
			<InlineEditField
				value={asset.defaultAltText ?? ''}
				onSave={(v) => onEditAltText(asset.id, v)}
				buttonLabel={ASSET_ALT_SAVE_LABEL}
				inputLabel={ASSET_ALT_TEXT_LABEL}
			/>
		</>
	);
}

function AssetUsageBadge({ asset, filter }: { asset: AssetItem; filter: 'active' | 'archived' }) {
	const inUse = asset.usage.usedInDraft || asset.usage.usedInPublished;
	const isDemo = asset.isDemo ?? false;
	let label: string;
	if (isDemo) {
		label = DEMO_ASSET_LABEL;
	} else if (filter === 'archived') {
		label = ARCHIVED_DATE_LABEL;
	} else {
		label = getAssetUsageLabel(asset.usage.usedInDraft, asset.usage.usedInPublished);
	}
	return (
		<span
			className={`asset-library__usage ${
				inUse ? 'asset-library__usage--active' : 'asset-library__usage--inactive'
			}`}
		>
			{label}
		</span>
	);
}

function AssetActions({
	asset,
	filter,
	pendingId,
	onRestore,
	onDelete,
}: {
	asset: AssetItem;
	filter: 'active' | 'archived';
	pendingId: string | null;
	onRestore: (asset: AssetItem) => Promise<void>;
	onDelete: (asset: AssetItem) => Promise<void>;
}) {
	const isDemo = asset.isDemo ?? false;
	if (isDemo) return null;

	if (filter === 'archived') {
		return (
			<button
				className="asset-library__restore"
				type="button"
				onClick={() => onRestore(asset)}
				disabled={pendingId === asset.id}
				aria-busy={pendingId === asset.id}
				aria-label={`Restaurar ${asset.displayName}`}
			>
				{pendingId === asset.id ? 'Restaurando...' : RESTORE_LABEL}
			</button>
		);
	}

	const inUse = asset.usage.usedInDraft || asset.usage.usedInPublished;
	return (
		<button
			className="asset-library__delete"
			type="button"
			onClick={() => onDelete(asset)}
			disabled={inUse || pendingId === asset.id}
			aria-busy={pendingId === asset.id}
			aria-label={
				pendingId === asset.id
					? `Archivando ${asset.displayName}`
					: inUse
						? `No se puede archivar ${asset.displayName}: está siendo utilizada`
						: `Archivar ${asset.displayName}`
			}
			title={
				inUse
					? 'No se puede eliminar: la imagen está siendo utilizada'
					: pendingId === asset.id
						? 'Archivando...'
						: 'Archivar imagen'
			}
		>
			{pendingId === asset.id ? 'Archivando...' : 'Eliminar'}
		</button>
	);
}

function AssetListItem({
	asset,
	filter,
	pendingId,
	itemError,
	onRename,
	onEditAltText,
	onRestore,
	onDelete,
}: {
	asset: AssetItem;
	filter: 'active' | 'archived';
	pendingId: string | null;
	itemError: string | undefined;
	onRename: (assetId: string, newName: string) => Promise<void>;
	onEditAltText: (assetId: string, newAltText: string) => Promise<void>;
	onRestore: (asset: AssetItem) => Promise<void>;
	onDelete: (asset: AssetItem) => Promise<void>;
}) {
	const inUse = asset.usage.usedInDraft || asset.usage.usedInPublished;
	const isDemo = asset.isDemo ?? false;
	const sectionRefs = [
		...(asset.usage.draftSectionRefs ?? []),
		...(asset.usage.publishedSectionRefs ?? []),
	];

	return (
		<li
			className={`asset-library__item${inUse ? ' asset-library__item--in-use' : ''}${isDemo ? ' asset-library__item--demo' : ''}`}
		>
			<img
				src={asset.src}
				alt={asset.displayName}
				className="asset-library__thumbnail"
				loading="lazy"
				decoding="async"
			/>
			<div className="asset-library__info">
				<AssetNameSection
					asset={asset}
					filter={filter}
					onRename={onRename}
					onEditAltText={onEditAltText}
				/>
				<AssetUsageBadge asset={asset} filter={filter} />
				{sectionRefs.length > 0 && filter !== 'archived' && (
					<AssetSectionRefs refs={sectionRefs} />
				)}
			</div>
			<AssetActions
				asset={asset}
				filter={filter}
				pendingId={pendingId}
				onRestore={onRestore}
				onDelete={onDelete}
			/>
			{itemError && (
				<p className="asset-library__item-error" role="alert" aria-live="polite">
					{itemError}
				</p>
			)}
		</li>
	);
}

export default function AssetLibraryPanel({ invitationId }: Props) {
	const [filter, setFilter] = useState<'active' | 'archived'>('active');
	const { assets, loading, error, refresh: fetchAssets } = useAssetLibrary(invitationId, filter);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

	async function handlePatch(
		assetId: string,
		body: { displayName?: string; defaultAltText?: string },
	) {
		const csrfToken = getCsrfToken();
		const response = await fetch(
			`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/${encodeURIComponent(assetId)}`,
			{
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
				},
				body: JSON.stringify(body),
			},
		);
		if (!response.ok) {
			const result = await response.json().catch(() => ({}));
			throw new Error(
				(result as { error?: { message?: string } })?.error?.message ||
					'Error al guardar los cambios.',
			);
		}
	}

	async function handleRename(assetId: string, newName: string) {
		await handlePatch(assetId, { displayName: newName });
		fetchAssets();
	}

	async function handleEditAltText(assetId: string, newAltText: string) {
		await handlePatch(assetId, { defaultAltText: newAltText });
		fetchAssets();
	}

	async function handleRestore(asset: AssetItem) {
		setItemErrors((prev) => {
			if (!prev[asset.id]) return prev;
			const next = { ...prev };
			delete next[asset.id];
			return next;
		});
		setActionMessage(null);
		setPendingId(asset.id);

		try {
			const csrfToken = getCsrfToken();
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/${encodeURIComponent(asset.id)}`,
				{
					method: 'POST',
					headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
				},
			);
			if (!response.ok) {
				const result = await response.json();
				const message = result?.error?.message || 'No se pudo restaurar la imagen.';
				setItemErrors((prev) => ({ ...prev, [asset.id]: message }));
				return;
			}
			setActionMessage('Imagen restaurada correctamente.');
			fetchAssets();
		} catch {
			setItemErrors((prev) => ({
				...prev,
				[asset.id]: 'Error de red al restaurar la imagen.',
			}));
		} finally {
			setPendingId(null);
		}
	}

	async function handleDelete(asset: AssetItem) {
		setItemErrors((prev) => {
			if (!prev[asset.id]) return prev;
			const next = { ...prev };
			delete next[asset.id];
			return next;
		});
		setActionMessage(null);
		setPendingId(asset.id);

		try {
			const csrfToken = getCsrfToken();
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/${encodeURIComponent(asset.id)}`,
				{
					method: 'DELETE',
					headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
				},
			);
			const result = await response.json();
			if (!response.ok) {
				const details = result?.error?.details as { sectionRefs?: string[] } | undefined;
				const message = result?.error?.message || 'No se pudo eliminar la imagen.';
				setItemErrors((prev) => ({
					...prev,
					[asset.id]: buildConflictMessage(details, message),
				}));
				return;
			}
			setActionMessage('Imagen archivada correctamente.');
			fetchAssets();
		} catch {
			setItemErrors((prev) => ({
				...prev,
				[asset.id]: 'Error de red al eliminar la imagen.',
			}));
		} finally {
			setPendingId(null);
		}
	}

	return (
		<section
			className="asset-library"
			aria-labelledby="asset-library-title"
			aria-busy={loading || pendingId !== null}
		>
			<h3 id="asset-library-title">Biblioteca de imágenes</h3>
			<p className="asset-library__hint">
				Quitar de una sección no elimina la imagen de la biblioteca. Eliminar de la
				biblioteca solo archiva la imagen si no está en uso.
			</p>

			<AssetUploader invitationId={invitationId} onUploaded={fetchAssets} />

			{filter === 'archived' && (
				<p className="asset-library__hint asset-library__hint--archived" role="status">
					{ARCHIVED_HELP_LABEL}
				</p>
			)}

			<div className="asset-library__filter" role="tablist" aria-label="Filtrar biblioteca">
				<button
					type="button"
					role="tab"
					aria-selected={filter === 'active'}
					className={`asset-library__filter-btn${filter === 'active' ? ' asset-library__filter-btn--active' : ''}`}
					onClick={() => setFilter('active')}
				>
					{ACTIVE_TAB_LABEL}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={filter === 'archived'}
					className={`asset-library__filter-btn${filter === 'archived' ? ' asset-library__filter-btn--active' : ''}`}
					onClick={() => setFilter('archived')}
				>
					{ARCHIVED_TAB_LABEL}
				</button>
			</div>

			{loading && (
				<p className="asset-library__status" role="status">
					Cargando biblioteca...
				</p>
			)}
			{error && (
				<p className="asset-library__error" role="alert">
					{error}
				</p>
			)}
			{actionMessage && (
				<p className="asset-library__action asset-library__action--success" role="status">
					{actionMessage}
				</p>
			)}

			{!loading && !error && assets.length === 0 && (
				<div className="asset-library__empty" role="status">
					<p>{EMPTY_ASSET_LIBRARY_COPY.heading}</p>
					<p>{EMPTY_ASSET_LIBRARY_COPY.subtext}</p>
				</div>
			)}

			{assets.length > 0 && (
				<ul className="asset-library__list">
					{assets.map((asset) => (
						<AssetListItem
							key={asset.id}
							asset={asset}
							filter={filter}
							pendingId={pendingId}
							itemError={itemErrors[asset.id]}
							onRename={handleRename}
							onEditAltText={handleEditAltText}
							onRestore={handleRestore}
							onDelete={handleDelete}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
