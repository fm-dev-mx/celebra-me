/* eslint-disable max-lines -- Editor shell with 12+ sections; extracted panels to separate files */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EDITOR_SPLIT_BREAKPOINT } from '@/lib/editor/constants';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';
import ItineraryEditor from '@/components/dashboard/intake/editor/ItineraryEditor';
import LocationSectionEditor from '@/components/dashboard/intake/editor/LocationSectionEditor';
import FamilySectionEditor from '@/components/dashboard/intake/editor/FamilySectionEditor';
import MainSectionEditor from '@/components/dashboard/intake/editor/MainSectionEditor';
import MetadataSection from '@/components/dashboard/intake/editor/MetadataSection';
import PublicationSection from '@/components/dashboard/intake/editor/PublicationSection';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import Field from '@/components/dashboard/intake/editor/Field';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import EditorActionBar from '@/components/dashboard/intake/editor/EditorActionBar';
import EditorPreviewPane from '@/components/dashboard/intake/editor/EditorPreviewPane';
import EditorSidebar from '@/components/dashboard/intake/editor/EditorSidebar';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import AssetPicker from '@/components/dashboard/intake/editor/AssetPicker';
import AssetLibraryPanel from '@/components/dashboard/intake/editor/AssetLibraryPanel';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import type {
	InvitationEditorContextDTO,
	InvitationEditorMetadata,
} from '@/lib/dashboard/dto/intake';
import { useInvitationEditor } from '@/hooks/use-invitation-editor';
import { useAssetLibrary } from '@/lib/intake/use-asset-library';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { toErrorMessage } from '@/lib/rsvp/core/errors';
import { getPublicSlug } from '@/lib/intake/slug';
import { formatDateLong } from '@/lib/intake/constants';
import { CONTENT_SECTION_KEYS } from '@/lib/theme/theme-contract';
import {
	getEditorSectionById,
	type EditorSectionId,
} from '@/lib/intake/invitation-section-registry';
import {
	EDITOR_SECTION_PRESENTATION,
	GIFT_TYPE_LABELS,
	INVITATION_STATUS_LABELS,
} from '@/lib/intake/labels';
import {
	applySectionToBaseline,
	getDirtySectionKey,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';

interface Props {
	initialContext: InvitationEditorContextDTO;
}

type PickerField =
	| 'hero.backgroundImage'
	| 'hero.backgroundImageMobile'
	| 'hero.portrait'
	| 'family.featuredImage'
	| 'thankYou.image'
	| `location.${'ceremony' | 'reception'}.image`;

const SOURCE_LABELS: Record<string, string> = {
	draft: 'Borrador',
	published: 'Versión pública',
	demo: 'Demo',
	empty: 'Vacío',
};

const CONTENT_SOURCE_LABELS: Record<string, string> = {
	draft: 'Con borrador local',
	published: 'Basado en versión pública',
	demo: 'Demo',
	empty: 'Sin contenido',
	mixed: 'Contenido combinado',
};

const EDITOR_SECTION_KEYS: Record<string, string[]> = {
	hero: ['title', 'description', 'hero'],
	main: ['title', 'description', 'hero'],
	quote: ['quote'],
	family: ['family'],
	location: ['location'],
	countdown: ['countdown'],
	itinerary: ['itinerary'],
	rsvp: ['rsvp'],
	music: ['music'],
	gifts: ['gifts'],
	thankYou: ['thankYou'],
	messages: ['quote', 'thankYou'],
	gallery: ['gallery'],
	photoNotes: ['photoNotes'],
	publication: ['sectionOrder'],
};

function uniqueSectionPresentation(sections: string[]) {
	const presented = new Map<string, { id: string; label: string }>();
	for (const section of sections) {
		const p = EDITOR_SECTION_PRESENTATION[section];
		if (p) presented.set(p.id, p);
	}
	return Array.from(presented.values());
}

function getSectionPathRegex(): RegExp {
	return new RegExp(
		`\\b(${Object.keys(EDITOR_SECTION_PRESENTATION).join('|')})(?:\\.[\\w-]+|\\[\\d+\\])*`,
		'g',
	);
}

export function formatPublishErrorMessage(error: unknown): string {
	const message = toErrorMessage(error, 'No se pudieron publicar los cambios.');
	const sectionPathRegex = getSectionPathRegex();
	return message.replace(sectionPathRegex, (sectionPath) => {
		const key = sectionPath.split(/[.[]/, 1)[0];
		return EDITOR_SECTION_PRESENTATION[key]?.label ?? sectionPath;
	});
}

export function getCriticalSections(eventType: string, rsvpEnabled: boolean): Set<string> {
	const critical = new Set<string>(['hero', 'location']);
	if (eventType !== 'cumple') critical.add('family');
	if (rsvpEnabled) critical.add('rsvp');
	return critical;
}

function metadataFromContext(context: InvitationEditorContextDTO): InvitationEditorMetadata {
	const { title, slug, status, clientName, clientEmail, clientWhatsapp, photosReceived } =
		context.invitation;
	return { title, slug, status, clientName, clientEmail, clientWhatsapp, photosReceived };
}

// eslint-disable-next-line complexity -- Editor shell with 12+ sections tracking dirty/error/saving state independently
export default function InvitationEditor({ initialContext }: Props) {
	const editor = useInvitationEditor(initialContext);
	const invitationId = editor.context.invitation.id;
	const assetLookupSlug = editor.context.assetLookupSlug;
	const { assets: editorAssets } = useAssetLibrary(invitationId);
	const [content, setContent] = useState(editor.context.content);
	const [metadata, setMetadata] = useState(() => metadataFromContext(initialContext));
	const [contentBaseline, setContentBaseline] = useState(editor.context.content);
	const [metadataBaseline, setMetadataBaseline] = useState(() =>
		metadataFromContext(initialContext),
	);
	const [dirty, setDirty] = useState<Set<string>>(new Set());
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [success, setSuccess] = useState<Record<string, string>>({});
	const [previewVersion, setPreviewVersion] = useState(0);
	const [previewHash, setPreviewHash] = useState('');
	const [selectedSection, setSelectedSection] = useState<EditorSectionId>('hero');
	const previewPaneRef = useRef<HTMLElement | null>(null);
	const refreshSavedPreview = () => {
		setPreviewVersion((version) => version + 1);
	};

	const handleSelectSection = useCallback((sectionId: string) => {
		const section = getEditorSectionById(sectionId);
		if (!section) return;
		setSelectedSection(section.id);
		setPreviewHash(section.previewAnchor);
	}, []);

	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (dirty.size === 0) return;
			event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);

	const markDirty = (section: string) => {
		setDirty((current) => new Set(current).add(section));
		setSuccess((current) => ({ ...current, [section]: '' }));
	};

	const updateContent = <Key extends keyof DraftContent>(key: Key, value: DraftContent[Key]) => {
		setContent((current) => ({ ...current, [key]: value }));
		markDirty(getDirtySectionKey(key));
	};

	const sectionValue = useCallback(
		(section: InvitationEditorSectionKey): unknown => getSectionValue(content, section),
		[content],
	);

	const updateContentBaseline = (section: InvitationEditorSectionKey, value: DraftContent) => {
		setContentBaseline((current) => applySectionToBaseline(current, section, value));
	};

	const saveSection = async (
		section: InvitationEditorSectionKey,
		expectedUpdatedAt?: string,
		shouldRefreshPreview = true,
	) => {
		setErrors((current) => ({ ...current, [section]: '' }));
		try {
			const result = await editor.saveSection(
				section,
				sectionValue(section),
				expectedUpdatedAt,
			);
			updateContentBaseline(section, content);
			setDirty((current) => {
				const next = new Set(current);
				next.delete(section);
				return next;
			});
			setSuccess((current) => ({ ...current, [section]: 'Sección guardada.' }));
			if (shouldRefreshPreview) refreshSavedPreview();
			return result;
		} catch (error) {
			setErrors((current) => ({
				...current,
				[section]: toErrorMessage(error, 'No se pudo guardar la sección.'),
			}));
		}
	};

	const saveMetadata = async (expectedUpdatedAt?: string, shouldRefreshPreview = true) => {
		setErrors((current) => ({ ...current, metadata: '' }));
		try {
			const invitation = await editor.saveMetadata(metadata, expectedUpdatedAt);
			const nextMetadata = metadataFromContext({ ...editor.context, invitation });
			setMetadata(nextMetadata);
			setMetadataBaseline(nextMetadata);
			setDirty((current) => {
				const next = new Set(current);
				next.delete('metadata');
				return next;
			});
			setSuccess((current) => ({ ...current, metadata: 'Datos guardados.' }));
			if (shouldRefreshPreview) refreshSavedPreview();
			return invitation;
		} catch (error) {
			setErrors((current) => ({
				...current,
				metadata: toErrorMessage(error, 'No se pudieron guardar los datos.'),
			}));
		}
	};

	const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
	const [confirmation, setConfirmation] = useState<'publish' | 'restore' | null>(null);
	const [pickerField, setPickerField] = useState<PickerField | null>(null);

	const publish = async () => {
		setConfirmation(null);
		setErrors((current) => ({ ...current, publish: '' }));
		try {
			const ctx = await editor.publish();
			setSuccess((current) => ({
				...current,
				publish: 'Cambios publicados correctamente.',
			}));
			const slug = getPublicSlug(ctx.invitation);
			setPublishedSlug(slug);
			refreshSavedPreview();
		} catch (error) {
			setErrors((current) => ({
				...current,
				publish: formatPublishErrorMessage(error),
			}));
		}
	};

	const main = content.hero ?? {};
	const family = content.family ?? {};
	const location = content.location ?? {};
	const countdown = content.countdown ?? {};
	const rsvp = content.rsvp ?? {};
	const music = content.music ?? {};
	const gifts = content.gifts ?? { items: [] };
	const giftItems = gifts.items ?? [];
	const messages = { quote: content.quote ?? {}, thankYou: content.thankYou ?? {} };
	const photoNotes = content.photoNotes ?? {};
	const sectionOrder = content.sectionOrder ?? [...CONTENT_SECTION_KEYS];

	const updateGiftItem = (index: number, patch: Record<string, unknown>) => {
		updateContent('gifts', {
			...gifts,
			items: giftItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
		});
	};

	const updateHero = (patch: Partial<typeof main>) =>
		updateContent('hero', { ...main, ...patch });
	const updateFamily = (patch: Partial<typeof family>) =>
		updateContent('family', { ...family, ...patch });
	const updateLocation = (patch: Partial<typeof location>) =>
		updateContent('location', { ...location, ...patch });
	const updateCountdown = (patch: Partial<typeof countdown>) =>
		updateContent('countdown', { ...countdown, ...patch });
	const updateRsvp = (patch: Partial<typeof rsvp>) =>
		updateContent('rsvp', { ...rsvp, ...patch });

	const sectionSource = useCallback(
		(section: string): { source: string; label: string } | undefined => {
			const definition = getEditorSectionById(section);
			const key = definition?.saveSectionKey ?? section;
			const keys = EDITOR_SECTION_KEYS[section] ?? EDITOR_SECTION_KEYS[key];
			if (!keys) return undefined;
			for (const source of ['draft', 'published', 'demo'] as const) {
				if (keys.some((key) => editor.context.sectionStates[key] === source)) {
					return { source, label: SOURCE_LABELS[source] };
				}
			}
			return { source: 'empty', label: SOURCE_LABELS.empty };
		},
		[editor.context.sectionStates],
	);

	const getSectionHasContent = useCallback(
		(sectionId: string): boolean => {
			const def = getEditorSectionById(sectionId);
			if (!def) return false;
			if (def.draftContentKeys.length === 0) return true;
			return def.draftContentKeys.some(
				(key) =>
					editor.context.sectionStates[key] &&
					editor.context.sectionStates[key] !== 'empty',
			);
		},
		[editor.context.sectionStates],
	);

	const hasDraft = editor.context.draftStatus !== null;
	const noDraftWarning =
		!hasDraft && editor.context.contentSource !== 'empty'
			? 'Esta invitación aún no tiene un borrador. Al guardar cualquier sección se creará un borrador a partir del contenido existente.'
			: null;

	const rsvpEnabled = useMemo(
		() =>
			editor.context.rsvpLink.status !== 'missing' ||
			editor.context.sectionStates.rsvp !== 'empty',
		[editor.context.rsvpLink.status, editor.context.sectionStates.rsvp],
	);

	const eventType = editor.context.invitation.eventType;
	const themeId = editor.context.invitation.themeId;

	const criticalSections = useMemo(
		() => getCriticalSections(eventType, rsvpEnabled),
		[eventType, rsvpEnabled],
	);

	const emptySectionsDetail = useMemo(() => {
		const critical: string[] = [];
		const optional: string[] = [];
		for (const [section, state] of Object.entries(editor.context.sectionStates)) {
			if (state !== 'empty') continue;
			if (criticalSections.has(section)) critical.push(section);
			else optional.push(section);
		}
		return { critical, optional };
	}, [editor.context.sectionStates, criticalSections]);

	const publishWarning = useMemo(() => {
		if (editor.context.contentSource === 'empty') return 'No hay contenido para publicar.';
		if (emptySectionsDetail.critical.length > 0) {
			const labels = emptySectionsDetail.critical
				.map((s) => EDITOR_SECTION_PRESENTATION[s]?.label ?? s)
				.join(', ');
			return `Secciones críticas vacías: ${labels}. Revisa el contenido antes de publicar.`;
		}
		if (emptySectionsDetail.optional.length > 0) {
			return `${emptySectionsDetail.optional.length} sección(es) opcional(es) vacías. Puedes publicar sin ellas.`;
		}
		if (!hasDraft && editor.context.contentSource !== 'draft') {
			return 'No hay cambios sin publicar. Guarda una sección primero.';
		}
		return null;
	}, [editor.context.contentSource, emptySectionsDetail, hasDraft]);
	const publishWarningSections = useMemo(
		() =>
			uniqueSectionPresentation([
				...emptySectionsDetail.critical,
				...emptySectionsDetail.optional,
			]),
		[emptySectionsDetail],
	);
	const publishSummary = useMemo(
		() =>
			uniqueSectionPresentation(
				Object.entries(editor.context.sectionStates)
					.filter(([, source]) => source === 'draft')
					.map(([section]) => section),
			).map((section) => section.label),
		[editor.context.sectionStates],
	);

	const [savingAll, setSavingAll] = useState(false);

	const discardChanges = () => {
		if (dirty.size === 0) return;
		if (!window.confirm('¿Descartar todos los cambios sin guardar?')) return;
		setContent(contentBaseline);
		setMetadata(metadataBaseline);
		setDirty(new Set());
		setErrors({});
		setSuccess({});
	};

	const saveAllDirty = useCallback(async (): Promise<boolean> => {
		const dirtyArray = Array.from(dirty);
		if (dirtyArray.length === 0) return true;
		setSavingAll(true);
		setErrors({});
		setSuccess({});

		let allSucceeded = true;
		let nextExpectedUpdatedAt: string | undefined;
		const initialExpectedUpdatedAt =
			editor.context.draftUpdatedAt ?? editor.context.invitation.updatedAt;

		for (const section of dirtyArray) {
			const expectedUpdateAt = nextExpectedUpdatedAt ?? initialExpectedUpdatedAt;

			if (section === 'metadata') {
				const result = await saveMetadata(expectedUpdateAt, false);
				if (!result) {
					allSucceeded = false;
					break;
				}
				nextExpectedUpdatedAt = result.updatedAt;
			} else {
				const sectionKey = section as InvitationEditorSectionKey;
				const result = await saveSection(sectionKey, expectedUpdateAt, false);
				if (!result) {
					allSucceeded = false;
					break;
				}
				nextExpectedUpdatedAt = result.draftUpdatedAt;
			}
		}

		setSavingAll(false);
		if (allSucceeded) refreshSavedPreview();
		return allSucceeded;
	}, [
		dirty,
		saveMetadata,
		saveSection,
		editor.context.draftUpdatedAt,
		editor.context.invitation.updatedAt,
		refreshSavedPreview,
	]);

	const previewUrl = `/dashboard/invitaciones/${encodeURIComponent(
		invitationId,
	)}/preview?v=${previewVersion}`;
	const backUrl = '/dashboard/invitaciones';
	const publishDisabled = useMemo(
		() =>
			editor.publishing ||
			savingAll ||
			editor.savingSection !== null ||
			dirty.size > 0 ||
			editor.context.draftStatus !== 'draft' ||
			editor.context.contentSource === 'empty' ||
			emptySectionsDetail.critical.length > 0,
		[
			editor.publishing,
			savingAll,
			editor.savingSection,
			dirty,
			editor.context.draftStatus,
			editor.context.contentSource,
			emptySectionsDetail.critical.length,
		],
	);

	const restorePublished = async () => {
		setConfirmation(null);
		try {
			const nextContext = await editor.restorePublished();
			setContent(nextContext.content);
			setContentBaseline(nextContext.content);
			setDirty(new Set());
			setErrors({});
			setSuccess({ restore: 'Se restauró la versión pública como borrador editable.' });
			refreshSavedPreview();
		} catch (error) {
			setErrors((current) => ({
				...current,
				restore: toErrorMessage(error, 'No se pudo restaurar la versión pública.'),
			}));
		}
	};

	const requestPreview = useCallback(() => {
		const isDesktop = window.matchMedia(
			`(min-width: ${EDITOR_SPLIT_BREAKPOINT + 1}px)`,
		).matches;
		if (isDesktop && previewPaneRef.current) {
			previewPaneRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
			previewPaneRef.current.focus({ preventScroll: true });
			return;
		}
		window.open(previewUrl, '_blank', 'noopener,noreferrer');
	}, [previewUrl]);

	const selectedDefinition = getEditorSectionById(selectedSection);
	const activeEditorCardId = selectedDefinition?.editorCardId ?? 'main';

	return (
		<div className="invitation-editor">
			<EditorActionBar
				dirtyCount={dirty.size}
				savingAll={savingAll}
				publishing={editor.publishing}
				publishWarning={publishWarning}
				publishDisabled={publishDisabled}
				onSaveAll={saveAllDirty}
				onDiscard={discardChanges}
				onPublish={() => setConfirmation('publish')}
				editUrl={backUrl}
				onPreviewRequest={requestPreview}
			/>
			<header className="invitation-editor__header">
				<div className="invitation-editor__header-info">
					<div className="invitation-editor__header-badges">
						<span
							className={`invitation-editor__content-badge invitation-editor__content-badge--${editor.context.contentSource}`}
						>
							{CONTENT_SOURCE_LABELS[editor.context.contentSource] ??
								editor.context.contentSource}
						</span>
						{editor.context.invitation.kind === 'demo' && (
							<span className="invitation-editor__content-badge invitation-editor__content-badge--demo-tag">
								Demo
							</span>
						)}
					</div>
					<h1>{metadata.title}</h1>
					<div className="invitation-editor__header-meta">
						<span
							className={`invitation-editor__status-badge invitation-editor__status-badge--${metadata.status}`}
						>
							{INVITATION_STATUS_LABELS[metadata.status] ?? metadata.status}
						</span>
						{editor.context.publication.version != null && (
							<span className="invitation-editor__version-badge">
								v{editor.context.publication.version}
							</span>
						)}
						<span className="invitation-editor__publication-state">
							{editor.context.publication.hasUnpublishedChanges
								? 'Hay cambios sin publicar'
								: 'La versión pública está actualizada'}
						</span>
					</div>
				</div>
				{noDraftWarning && (
					<p className="invitation-editor__warning invitation-editor__warning--guard">
						{noDraftWarning}
					</p>
				)}
				{publishWarning && (
					<div className="invitation-editor__warning invitation-editor__warning--guard">
						<p>{publishWarning}</p>
						{publishWarningSections.length > 0 && (
							<div>
								{publishWarningSections.map((section) => (
									<a href={`#${section.id}`} key={section.id}>
										{section.label}
									</a>
								))}
							</div>
						)}
					</div>
				)}
				{!editor.context.publication.hasPublishedContent && (
					<div className="invitation-editor__warning invitation-editor__warning--guard">
						<p>
							<strong>Sin publicación.</strong> La URL pública{' '}
							<code>
								/{editor.context.invitation.eventType}/
								{editor.context.invitation.slug ?? '...'}
							</code>{' '}
							no está disponible hasta que publiques. Usa{' '}
							<strong>Vista previa</strong> para ver el borrador.
						</p>
					</div>
				)}
				{errors.publish && <p className="invitation-editor__error">{errors.publish}</p>}
				{success.publish && !publishedSlug && (
					<p className="invitation-editor__success">{success.publish}</p>
				)}
				{success.publish && publishedSlug && (
					<div className="invitation-editor__publish-success">
						<h2>¡Publicado exitosamente!</h2>
						<p>Los cambios ya están visibles en la página pública.</p>
						<div className="invitation-editor__publish-actions">
							<a
								href={`/${editor.context.invitation.eventType}/${publishedSlug}`}
								target="_blank"
								rel="noopener noreferrer"
								className="invitation-editor__primary-action"
							>
								Ver página pública
							</a>
							<a
								href="/dashboard/invitaciones"
								className="invitation-editor__secondary-action"
							>
								Volver al listado
							</a>
							<button
								type="button"
								className="invitation-editor__secondary-action"
								onClick={() => setPublishedSlug(null)}
							>
								Seguir editando
							</button>
						</div>
					</div>
				)}
			</header>

			<div className="invitation-editor__layout">
				<EditorSidebar
					activeSection={selectedSection}
					savingSection={editor.savingSection}
					dirty={dirty}
					errors={errors}
					sectionSource={sectionSource}
					sectionOrder={sectionOrder}
					onSectionOrderChange={(value) => {
						updateContent('sectionOrder', value as DraftContent['sectionOrder']);
					}}
					getSectionHasContent={getSectionHasContent}
					onSelectSection={handleSelectSection}
				/>

				<main className="invitation-editor__content">
					<SectionCard
						id="metadata"
						title="Datos de la invitación"
						description="Información administrativa, URL pública y seguimiento de producción."
						dirty={dirty.has('metadata')}
						error={errors.metadata}
						success={success.metadata}
						sourceBadge={undefined}
						visible={activeEditorCardId === 'metadata'}
					>
						<MetadataSection
							value={metadata}
							onChange={(value) => {
								setMetadata(value);
								markDirty('metadata');
							}}
						/>
					</SectionCard>

					<MainSectionEditor
						content={content}
						main={main}
						eventType={eventType}
						themeId={themeId}
						invitationId={invitationId}
						dirty={dirty.has('main')}
						error={errors.main}
						success={success.main}
						sourceBadge={sectionSource('main')}
						onUpdateContent={updateContent}
						onUpdateHero={updateHero}
						onOpenAssetPicker={setPickerField}
						assetLookupSlug={assetLookupSlug}
						assets={editorAssets}
						visible={activeEditorCardId === 'main'}
					/>

					<FamilySectionEditor
						family={family}
						eventType={eventType}
						invitationId={invitationId}
						dirty={dirty.has('family')}
						error={errors.family}
						success={success.family}
						sourceBadge={sectionSource('family')}
						onUpdateFamily={updateFamily}
						onOpenAssetPicker={setPickerField}
						assetLookupSlug={assetLookupSlug}
						assets={editorAssets}
						visible={activeEditorCardId === 'family'}
					/>

					<LocationSectionEditor
						location={location}
						dirty={dirty.has('location')}
						error={errors.location}
						success={success.location}
						sourceBadge={sectionSource('location')}
						onUpdateLocation={updateLocation}
						onOpenAssetPicker={setPickerField}
						assetLookupSlug={assetLookupSlug}
						assets={editorAssets}
						visible={activeEditorCardId === 'location'}
					/>

					<SectionCard
						id="countdown"
						title="Cuenta regresiva"
						description="Esta sección pública usa la fecha principal de la invitación."
						dirty={dirty.has('countdown')}
						error={errors.countdown}
						success={success.countdown}
						sourceBadge={sectionSource('countdown')}
						visible={activeEditorCardId === 'countdown'}
					>
						<p className="invitation-editor__helper-text">
							La fecha del evento en la cuenta regresiva se calcula automáticamente
							desde la Portada.
						</p>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título"
								value={countdown.title ?? ''}
								onChange={(value) => updateCountdown({ title: value })}
							/>
							<Field
								label="Texto antes de la fecha"
								value={countdown.subtitlePrefix ?? ''}
								onChange={(value) => updateCountdown({ subtitlePrefix: value })}
							/>
						</div>
						<TextArea
							label="Texto final"
							value={countdown.footerText ?? ''}
							onChange={(value) => updateCountdown({ footerText: value })}
						/>
						<div className="invitation-editor__countdown-preview">
							<span className="invitation-editor__countdown-preview-label">
								Fecha visible en cuenta regresiva:
							</span>
							<span className="invitation-editor__countdown-preview-date">
								{main.date ? formatDateLong(main.date) : 'Sin fecha'}
							</span>
						</div>
					</SectionCard>

					<SectionCard
						id="itinerary"
						title="Programa"
						description="Orden y horario de actividades."
						dirty={dirty.has('itinerary')}
						error={errors.itinerary}
						success={success.itinerary}
						sourceBadge={sectionSource('itinerary')}
						visible={activeEditorCardId === 'itinerary'}
					>
						<ItineraryEditor
							value={content.itinerary ?? { items: [] }}
							onChange={(value) => updateContent('itinerary', value)}
						/>
					</SectionCard>

					<SectionCard
						id="rsvp"
						title="Confirmación de asistencia"
						description="Configuración visible para invitados; las respuestas permanecen separadas."
						dirty={dirty.has('rsvp')}
						error={errors.rsvp}
						success={success.rsvp}
						sourceBadge={sectionSource('rsvp')}
						visible={activeEditorCardId === 'rsvp'}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título"
								value={rsvp.title ?? ''}
								onChange={(value) => updateRsvp({ title: value })}
								labelExtra={
									<TextPresetPicker
										section="rsvpTitle"
										onSelect={(value) => updateRsvp({ title: value })}
									/>
								}
							/>
							<Field
								label="Máximo de acompañantes"
								type="number"
								value={String(rsvp.guestCap ?? '')}
								onChange={(value) =>
									updateRsvp({ guestCap: value ? Number(value) : undefined })
								}
							/>
							<label className="invitation-editor__field">
								<span>Modo de confirmación</span>
								<select
									value={rsvp.confirmationMode ?? 'api'}
									onChange={(event) =>
										updateRsvp({ confirmationMode: event.target.value })
									}
								>
									<option value="api">Formulario</option>
									<option value="whatsapp">WhatsApp</option>
									<option value="both">Formulario y WhatsApp</option>
								</select>
							</label>
							{['whatsapp', 'both'].includes(rsvp.confirmationMode ?? '') && (
								<Field
									label="WhatsApp"
									value={rsvp.whatsappPhone ?? ''}
									onChange={(value) => updateRsvp({ whatsappPhone: value })}
								/>
							)}
						</div>
						<TextArea
							label="Mensaje de confirmación"
							value={rsvp.confirmationMessage ?? ''}
							onChange={(value) => updateRsvp({ confirmationMessage: value })}
							labelExtra={
								<TextPresetPicker
									section="rsvpMessage"
									onSelect={(value) => updateRsvp({ confirmationMessage: value })}
								/>
							}
						/>
						<TextArea
							label="Texto secundario"
							value={rsvp.subcopy ?? ''}
							onChange={(value) => updateRsvp({ subcopy: value })}
						/>
					</SectionCard>

					<SectionCard
						id="music"
						title="Música"
						description="Pista musical de la experiencia pública."
						dirty={dirty.has('music')}
						error={errors.music}
						success={success.music}
						sourceBadge={sectionSource('music')}
						visible={activeEditorCardId === 'music'}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="URL de audio"
								type="url"
								value={music.url ?? ''}
								onChange={(value) =>
									updateContent('music', { ...music, url: value })
								}
							/>
							<Field
								label="Título"
								value={music.title ?? ''}
								onChange={(value) =>
									updateContent('music', { ...music, title: value })
								}
							/>
						</div>
					</SectionCard>

					<SectionCard
						id="gifts"
						title="Mesa de regalos"
						description="Opciones de regalo visibles para invitados."
						dirty={dirty.has('gifts')}
						error={errors.gifts}
						success={success.gifts}
						sourceBadge={sectionSource('gifts')}
						visible={activeEditorCardId === 'gifts'}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título"
								value={gifts.title ?? ''}
								onChange={(value) =>
									updateContent('gifts', { ...gifts, title: value })
								}
								labelExtra={
									<TextPresetPicker
										section="gifts"
										onSelect={(value) =>
											updateContent('gifts', { ...gifts, title: value })
										}
									/>
								}
							/>
							<Field
								label="Subtítulo"
								value={gifts.subtitle ?? ''}
								onChange={(value) =>
									updateContent('gifts', { ...gifts, subtitle: value })
								}
							/>
						</div>
						<div className="invitation-editor__stack">
							{giftItems.map((item, index) => (
								<div
									className="invitation-editor__list-item"
									key={`${item.type}-${index}`}
								>
									<div className="invitation-editor__compact-row">
										<strong>
											{index + 1}.{' '}
											{item.title || GIFT_TYPE_LABELS[item.type] || item.type}
											<span className="invitation-editor__gift-type-label">
												{GIFT_TYPE_LABELS[item.type] ?? item.type}
											</span>
										</strong>
										<button
											type="button"
											className="invitation-editor__link-button"
											onClick={() =>
												updateContent('gifts', {
													...gifts,
													items: giftItems.filter((_, i) => i !== index),
												})
											}
										>
											Eliminar opción
										</button>
									</div>
									<details className="invitation-editor__row-details">
										<summary>Editar opción</summary>
										<div className="invitation-editor__field-grid">
											<Field
												label="Tipo"
												value={GIFT_TYPE_LABELS[item.type] ?? item.type}
												onChange={() => undefined}
											/>
											<Field
												label="Título"
												value={item.title ?? ''}
												onChange={(value) =>
													updateGiftItem(index, { title: value })
												}
											/>
											{'url' in item && (
												<Field
													label="URL"
													type="url"
													value={item.url}
													onChange={(value) =>
														updateGiftItem(index, { url: value })
													}
												/>
											)}
											{'bankName' in item && (
												<>
													<Field
														label="Banco"
														value={item.bankName}
														onChange={(value) =>
															updateGiftItem(index, {
																bankName: value,
															})
														}
													/>
													<Field
														label="Titular"
														value={item.accountHolder}
														onChange={(value) =>
															updateGiftItem(index, {
																accountHolder: value,
															})
														}
													/>
													<Field
														label="CLABE"
														value={item.clabe}
														onChange={(value) =>
															updateGiftItem(index, { clabe: value })
														}
													/>
												</>
											)}
											{'text' in item && (
												<Field
													label="Texto"
													value={item.text ?? ''}
													onChange={(value) =>
														updateGiftItem(index, { text: value })
													}
												/>
											)}
										</div>
									</details>
								</div>
							))}
						</div>
						<button
							type="button"
							className="invitation-editor__secondary-button"
							onClick={() =>
								updateContent('gifts', {
									...gifts,
									items: [
										...giftItems,
										{ type: 'cash', title: 'Lluvia de Sobres', text: '' },
									],
								})
							}
						>
							Agregar opción
						</button>
					</SectionCard>

					<SectionCard
						id="quote"
						title="Frase"
						description="Texto destacado que acompaña la apertura de la invitación."
						dirty={dirty.has('messages')}
						error={errors.messages}
						success={success.messages}
						sourceBadge={sectionSource('quote')}
						visible={activeEditorCardId === 'quote'}
					>
						<TextArea
							label="Frase"
							value={messages.quote.text ?? ''}
							onChange={(value) =>
								updateContent('quote', { ...messages.quote, text: value })
							}
							labelExtra={
								<TextPresetPicker
									section="quote"
									eventType={eventType}
									onSelect={(value) =>
										updateContent('quote', { ...messages.quote, text: value })
									}
								/>
							}
						/>
						<Field
							label="Autor"
							value={messages.quote.author ?? ''}
							onChange={(value) =>
								updateContent('quote', { ...messages.quote, author: value })
							}
						/>
					</SectionCard>

					<SectionCard
						id="thankYou"
						title="Agradecimiento"
						description="Mensaje final visible al cierre de la invitación."
						dirty={dirty.has('messages')}
						error={errors.messages}
						success={success.messages}
						sourceBadge={sectionSource('thankYou')}
						visible={activeEditorCardId === 'thankYou'}
					>
						<TextArea
							label="Mensaje de agradecimiento"
							value={messages.thankYou.message ?? ''}
							onChange={(value) =>
								updateContent('thankYou', { ...messages.thankYou, message: value })
							}
							labelExtra={
								<TextPresetPicker
									section="thankYou"
									onSelect={(value) =>
										updateContent('thankYou', {
											...messages.thankYou,
											message: value,
										})
									}
								/>
							}
						/>
						<Field
							label="Firma"
							value={messages.thankYou.closingName ?? ''}
							onChange={(value) =>
								updateContent('thankYou', {
									...messages.thankYou,
									closingName: value,
								})
							}
						/>
						{invitationId && (
							<ImageAssetField
								label="Imagen de agradecimiento"
								value={messages.thankYou.image}
								assetLookupSlug={assetLookupSlug}
								assets={editorAssets}
								onOpenLibrary={() => setPickerField('thankYou.image')}
								isDefaultImage={editor.context.sectionStates.thankYou === 'demo'}
							/>
						)}
					</SectionCard>

					<SectionCard
						id="gallery"
						title="Galería"
						description="Fotografías, orden, pies de foto y punto focal. Se guardan juntas."
						dirty={dirty.has('gallery')}
						error={errors.gallery}
						success={success.gallery}
						sourceBadge={sectionSource('gallery')}
						visible={activeEditorCardId === 'gallery'}
					>
						<GalleryEditor
							value={content.gallery ?? { items: [] }}
							assetLookupSlug={assetLookupSlug}
							variant={editor.context.invitation.themeId}
							invitationId={invitationId}
							onChange={(value) => updateContent('gallery', value)}
							photoNotes={photoNotes}
							onPhotoNotesChange={(value) => updateContent('photoNotes', value)}
							onSavePhotoNotes={() => void saveSection('photoNotes')}
							photoNotesDirty={dirty.has('photoNotes')}
							savingPhotoNotes={editor.savingSection === 'photoNotes'}
							assets={editorAssets}
						/>
					</SectionCard>

					<SectionCard
						id="publication"
						title="Publicación"
						description="Versión vigente, restauración y salud del evento RSVP."
						dirty={dirty.has('publication')}
						error={errors.publication}
						success={success.publication}
						sourceBadge={sectionSource('publication')}
						visible={activeEditorCardId === 'publication'}
					>
						<PublicationSection
							context={editor.context}
							reconciling={editor.reconciling}
							onReconcile={() => void editor.reconcileRsvp()}
							restoring={editor.restoring}
							onRestorePublished={() => setConfirmation('restore')}
						/>
						{errors.restore && (
							<p className="invitation-editor__error">{errors.restore}</p>
						)}
						{success.restore && (
							<p className="invitation-editor__success">{success.restore}</p>
						)}
					</SectionCard>

					<SectionCard
						id="assetLibrary"
						title="Biblioteca de imágenes"
						description="Administra las imágenes subidas para esta invitación."
						dirty={false}
						visible={activeEditorCardId === 'assetLibrary'}
					>
						<AssetLibraryPanel invitationId={invitationId} />
					</SectionCard>

					<SectionCard
						id="personalizedAccess"
						title="Acceso personalizado"
						description="Estado informativo del acceso personalizado de invitados."
						dirty={false}
						visible={activeEditorCardId === 'personalizedAccess'}
					>
						<p className="invitation-editor__helper-text">
							El acceso personalizado se controla desde los enlaces e invitados. No
							tiene contenido editable como una sección pública normal.
						</p>
					</SectionCard>
				</main>
				<EditorPreviewPane
					paneRef={previewPaneRef}
					invitationId={invitationId}
					hasUnsavedChanges={dirty.size > 0}
					previewVersion={previewVersion}
					previewHash={previewHash}
					onReload={refreshSavedPreview}
				/>
			</div>
			{confirmation === 'restore' && (
				<ConfirmModal
					title="Restaurar desde versión pública"
					message="Esta acción reemplazará el borrador editable con el contenido de la versión pública actual. Los cambios sin guardar se perderán."
					confirmLabel="Restaurar versión pública"
					destructive
					loading={editor.restoring}
					onCancel={() => setConfirmation(null)}
					onConfirm={() => void restorePublished()}
				/>
			)}
			{confirmation === 'publish' && (
				<ConfirmModal
					title="Publicar cambios"
					message="El borrador guardado reemplazará la versión pública actual. Revisa la vista previa antes de continuar."
					confirmLabel="Publicar cambios"
					previewUrl={previewUrl}
					summary={publishSummary}
					loading={editor.publishing}
					onCancel={() => setConfirmation(null)}
					onConfirm={() => void publish()}
				/>
			)}
			{pickerField && (
				<AssetPicker
					invitationId={invitationId}
					onSelect={(assetId) => {
						const ref = { type: 'uploaded' as const, assetId };
						const updateLocationVenue = (venueKey: 'ceremony' | 'reception') => {
							const venue = location[venueKey] ?? {};
							updateLocation({ [venueKey]: { ...venue, image: ref } });
						};
						const PICKER_FIELD_UPDATERS: Record<PickerField, () => void> = {
							'hero.backgroundImage': () => updateHero({ backgroundImage: ref }),
							'hero.backgroundImageMobile': () =>
								updateHero({ backgroundImageMobile: ref }),
							'hero.portrait': () => updateHero({ portrait: ref }),
							'family.featuredImage': () => updateFamily({ featuredImage: ref }),
							'thankYou.image': () =>
								updateContent('thankYou', { ...messages.thankYou, image: ref }),
							'location.ceremony.image': () => updateLocationVenue('ceremony'),
							'location.reception.image': () => updateLocationVenue('reception'),
						};
						PICKER_FIELD_UPDATERS[pickerField]();
						setPickerField(null);
					}}
					onClose={() => setPickerField(null)}
				/>
			)}
		</div>
	);
}
