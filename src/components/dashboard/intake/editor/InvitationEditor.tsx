/* eslint-disable max-lines -- Editor shell with 12+ sections; extracted SectionCard/Field/TextArea to separate files */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EDITOR_SPLIT_BREAKPOINT } from '@/lib/editor/constants';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';
import ItineraryEditor from '@/components/dashboard/intake/editor/ItineraryEditor';
import MetadataSection from '@/components/dashboard/intake/editor/MetadataSection';
import PublicationSection from '@/components/dashboard/intake/editor/PublicationSection';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import Field from '@/components/dashboard/intake/editor/Field';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import TextPresetPicker from '@/components/dashboard/intake/editor/TextPresetPicker';
import EditorActionBar from '@/components/dashboard/intake/editor/EditorActionBar';
import EditorPreviewPane from '@/components/dashboard/intake/editor/EditorPreviewPane';
import ConfirmModal from '@/components/dashboard/intake/ConfirmModal';
import AssetPicker from '@/components/dashboard/intake/editor/AssetPicker';
import AssetLibraryPanel from '@/components/dashboard/intake/editor/AssetLibraryPanel';
import type {
	InvitationEditorContextDTO,
	InvitationEditorMetadata,
} from '@/lib/dashboard/dto/intake';
import { useInvitationEditor } from '@/hooks/use-invitation-editor';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { toErrorMessage } from '@/lib/rsvp/core/errors';
import { getPublicSlug } from '@/lib/intake/slug';
import { CONTENT_SECTION_KEYS } from '@/lib/theme/theme-contract';
import {
	EDITOR_SECTION_PRESENTATION,
	GIFT_TYPE_LABELS,
	INVITATION_STATUS_LABELS,
	NAV_ITEMS,
	getFieldLabel,
} from '@/lib/intake/labels';
import {
	applySectionToBaseline,
	getDirtySectionKey,
	getSectionValue,
} from '@/lib/intake/services/section-content-mapper';

interface Props {
	initialContext: InvitationEditorContextDTO;
}

// NAV_ITEMS imported from labels.ts

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
	main: ['title', 'description', 'hero'],
	family: ['family'],
	location: ['location'],
	itinerary: ['itinerary'],
	rsvp: ['rsvp'],
	music: ['music'],
	gifts: ['gifts'],
	messages: ['quote', 'thankYou'],
	gallery: ['gallery'],
	photoNotes: ['photoNotes'],
	publication: ['sectionOrder'],
};

// CRITICAL_SECTION_LABELS — derived inline from EDITOR_SECTION_PRESENTATION where needed

// EDITOR_SECTION_PRESENTATION imported from labels.ts

function uniqueSectionPresentation(sections: string[]) {
	const presented = new Map<string, { id: string; label: string }>();
	for (const section of sections) {
		const p = EDITOR_SECTION_PRESENTATION[section];
		if (p) presented.set(p.id, p);
	}
	return Array.from(presented.values());
}

let sectionPathRegex: RegExp | null = null;
function getSectionPathRegex(): RegExp {
	if (!sectionPathRegex) {
		sectionPathRegex = new RegExp(
			`\\b(${Object.keys(EDITOR_SECTION_PRESENTATION).join('|')})(?:\\.[\\w-]+|\\[\\d+\\])*`,
			'g',
		);
	}
	return sectionPathRegex;
}

export function formatPublishErrorMessage(error: unknown): string {
	const message = toErrorMessage(error, 'No se pudieron publicar los cambios.');
	return message.replace(getSectionPathRegex(), (sectionPath) => {
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
	const previewPaneRef = useRef<HTMLElement | null>(null);
	const refreshSavedPreview = () => {
		setPreviewVersion((version) => version + 1);
	};

	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (dirty.size === 0) return;
			event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);

	const [activeSection, setActiveSection] = useState('');

	useEffect(() => {
		const ids = NAV_ITEMS.map((n) => n.id);
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveSection(entry.target.id);
					}
				}
			},
			{ rootMargin: '-40% 0px -55% 0px' },
		);
		const elements = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);
		for (const el of elements) observer.observe(el);
		return () => observer.disconnect();
	}, []);

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
	const [pickerField, setPickerField] = useState<string | null>(null);

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
	const updateRsvp = (patch: Partial<typeof rsvp>) =>
		updateContent('rsvp', { ...rsvp, ...patch });

	const savingSection = editor.savingSection;

	const sectionSource = useCallback(
		(section: string): { source: string; label: string } | undefined => {
			const keys = EDITOR_SECTION_KEYS[section];
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
	const isBoda = eventType === 'boda';

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
		editor.context.invitation.id,
	)}/preview?v=${previewVersion}`;
	const backUrl = '/dashboard/invitaciones';
	const publishDisabled = useMemo(
		() =>
			editor.publishing ||
			savingAll ||
			savingSection !== null ||
			dirty.size > 0 ||
			editor.context.draftStatus !== 'draft' ||
			editor.context.contentSource === 'empty' ||
			emptySectionsDetail.critical.length > 0,
		[
			editor.publishing,
			savingAll,
			savingSection,
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
				<nav className="invitation-editor__nav" aria-label="Secciones del editor">
					{NAV_ITEMS.map((item) => {
						const badge = sectionSource(item.id);
						const isSaving = savingSection === item.id;
						const hasError = Boolean(errors[item.id]);
						const itemClasses = [
							'invitation-editor__nav-item',
							activeSection === item.id ? 'invitation-editor__nav-item--active' : '',
							hasError ? 'invitation-editor__nav-item--error' : '',
						]
							.filter(Boolean)
							.join(' ');
						return (
							<a href={`#${item.id}`} key={item.id} className={itemClasses}>
								{badge && (
									<span
										className={`invitation-editor__nav-dot invitation-editor__nav-dot--${badge.source}`}
										title={badge.label}
										aria-label={`Fuente: ${badge.label}`}
									/>
								)}
								<span className="invitation-editor__nav-label">{item.label}</span>
								{isSaving && (
									<span
										className="invitation-editor__nav-saving"
										aria-label="guardando"
									>
										↻
									</span>
								)}
								{dirty.has(item.id) && !isSaving && (
									<span
										className="invitation-editor__nav-dirty"
										aria-label="con cambios sin guardar"
									>
										*
									</span>
								)}
								{hasError && (
									<span
										className="invitation-editor__nav-error-icon"
										aria-label="error al guardar"
										title={errors[item.id]}
									>
										!
									</span>
								)}
							</a>
						);
					})}
				</nav>

				<main className="invitation-editor__content">
					<SectionCard
						id="metadata"
						title="Datos de la invitación"
						description="Información administrativa, URL pública y seguimiento de producción."
						dirty={dirty.has('metadata')}
						saving={savingSection === 'metadata'}
						error={errors.metadata}
						success={success.metadata}
						onSave={() => void saveMetadata()}
						sourceBadge={undefined}
					>
						<MetadataSection
							value={metadata}
							onChange={(value) => {
								setMetadata(value);
								markDirty('metadata');
							}}
						/>
					</SectionCard>

					<SectionCard
						id="main"
						title="Datos principales"
						description="Texto principal que abre la invitación."
						dirty={dirty.has('main')}
						saving={savingSection === 'main'}
						error={errors.main}
						success={success.main}
						onSave={() => saveSection('main')}
						sourceBadge={sectionSource('main')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título público"
								value={content.title ?? ''}
								onChange={(value) => updateContent('title', value)}
							/>
							<Field
								label={getFieldLabel('hero', 'name', eventType)}
								value={main.name ?? ''}
								onChange={(value) => updateHero({ name: value })}
							/>
							{isBoda && (
								<Field
									label={getFieldLabel('hero', 'secondaryName', eventType)}
									value={main.secondaryName ?? ''}
									onChange={(value) => updateHero({ secondaryName: value })}
								/>
							)}
							<Field
								label={getFieldLabel('hero', 'label', eventType)}
								value={main.label ?? ''}
								onChange={(value) => updateHero({ label: value })}
							/>
							<Field
								label={getFieldLabel('hero', 'nickname', eventType)}
								value={main.nickname ?? ''}
								onChange={(value) => updateHero({ nickname: value })}
							/>
							<Field
								label={getFieldLabel('hero', 'date', eventType)}
								type="datetime-local"
								value={(main.date ?? '').replace('Z', '').slice(0, 16)}
								onChange={(value) => updateHero({ date: value })}
							/>
							{editor.context.invitation.id && (
								<>
									<label className="invitation-editor__field">
										<span>Imagen de portada</span>
										<button
											type="button"
											className="invitation-editor__asset-btn"
											onClick={() => setPickerField('hero.backgroundImage')}
										>
											{main.backgroundImage
												? 'Cambiar imagen'
												: 'Seleccionar imagen'}
										</button>
									</label>
									<label className="invitation-editor__field">
										<span>Retrato</span>
										<button
											type="button"
											className="invitation-editor__asset-btn"
											onClick={() => setPickerField('hero.portrait')}
										>
											{main.portrait
												? 'Cambiar retrato'
												: 'Seleccionar retrato'}
										</button>
									</label>
								</>
							)}
						</div>
						<TextArea
							label="Descripción"
							value={content.description ?? ''}
							onChange={(value) => updateContent('description', value)}
							labelExtra={
								<TextPresetPicker
									section="description"
									eventType={eventType}
									onSelect={(value) => updateContent('description', value)}
								/>
							}
						/>
					</SectionCard>

					<SectionCard
						id="family"
						title="Personas principales"
						description="Familia y personas destacadas."
						dirty={dirty.has('family')}
						saving={savingSection === 'family'}
						error={errors.family}
						success={success.family}
						onSave={() => saveSection('family')}
						sourceBadge={sectionSource('family')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label={getFieldLabel('family', 'fatherName', eventType)}
								value={family.fatherName ?? ''}
								onChange={(value) => updateFamily({ fatherName: value })}
							/>
							<Field
								label={getFieldLabel('family', 'motherName', eventType)}
								value={family.motherName ?? ''}
								onChange={(value) => updateFamily({ motherName: value })}
							/>
							{isBoda && (
								<Field
									label={getFieldLabel('family', 'spouseName', eventType)}
									value={family.spouseName ?? ''}
									onChange={(value) => updateFamily({ spouseName: value })}
								/>
							)}
						</div>
						<label className="invitation-editor__check">
							<input
								type="checkbox"
								checked={family.fatherDeceased ?? false}
								onChange={(event) =>
									updateFamily({ fatherDeceased: event.target.checked })
								}
							/>
							<span>Mostrar cruz junto al nombre del papá</span>
						</label>
						<label className="invitation-editor__check">
							<input
								type="checkbox"
								checked={family.motherDeceased ?? false}
								onChange={(event) =>
									updateFamily({ motherDeceased: event.target.checked })
								}
							/>
							<span>Mostrar cruz junto al nombre de la mamá</span>
						</label>
						<TextArea
							label={getFieldLabel('family', 'godparents', eventType)}
							value={family.godparents ?? ''}
							onChange={(value) => updateFamily({ godparents: value })}
						/>
						{isBoda && (
							<TextArea
								label={getFieldLabel('family', 'children', eventType)}
								value={family.children ?? ''}
								onChange={(value) => updateFamily({ children: value })}
							/>
						)}
						<TextArea
							label={getFieldLabel('family', 'sectionMessage', eventType)}
							value={family.sectionMessage ?? ''}
							onChange={(value) => updateFamily({ sectionMessage: value })}
							labelExtra={
								<TextPresetPicker
									section="familyMessage"
									eventType={eventType}
									onSelect={(value) => updateFamily({ sectionMessage: value })}
								/>
							}
						/>
					</SectionCard>

					<SectionCard
						id="location"
						title="Fecha y ubicaciones"
						description="Ceremonia, recepción e indicaciones."
						dirty={dirty.has('location')}
						saving={savingSection === 'location'}
						error={errors.location}
						success={success.location}
						onSave={() => saveSection('location')}
						sourceBadge={sectionSource('location')}
					>
						{(['ceremony', 'reception'] as const).map((venueKey) => {
							const venue = location[venueKey] ?? {};
							const updateVenue = (patch: Partial<typeof venue>) =>
								updateLocation({ [venueKey]: { ...venue, ...patch } });
							return (
								<div className="invitation-editor__subsection" key={venueKey}>
									<h3>{venueKey === 'ceremony' ? 'Ceremonia' : 'Recepción'}</h3>
									<div className="invitation-editor__field-grid">
										<Field
											label="Lugar"
											value={venue.venueName ?? ''}
											onChange={(value) => updateVenue({ venueName: value })}
										/>
										<Field
											label="Dirección"
											value={venue.address ?? ''}
											onChange={(value) => updateVenue({ address: value })}
										/>
										<Field
											label="Ciudad"
											value={venue.city ?? ''}
											onChange={(value) => updateVenue({ city: value })}
										/>
										<Field
											label="Fecha"
											type="date"
											value={venue.date ?? ''}
											onChange={(value) => updateVenue({ date: value })}
										/>
										<Field
											label="Hora"
											type="time"
											value={venue.time ?? ''}
											onChange={(value) => updateVenue({ time: value })}
										/>
										<Field
											label="Mapa"
											type="url"
											value={venue.mapUrl ?? ''}
											onChange={(value) => updateVenue({ mapUrl: value })}
										/>
									</div>
								</div>
							);
						})}
						<Field
							label="Código de vestimenta"
							value={location.dressCode ?? ''}
							onChange={(value) => updateLocation({ dressCode: value })}
							labelExtra={
								<TextPresetPicker
									section="dressCode"
									onSelect={(value) => updateLocation({ dressCode: value })}
								/>
							}
						/>
						<TextArea
							label="Indicaciones adicionales"
							value={location.additionalIndications ?? ''}
							onChange={(value) => updateLocation({ additionalIndications: value })}
						/>
					</SectionCard>

					<SectionCard
						id="itinerary"
						title="Programa"
						description="Orden y horario de actividades."
						dirty={dirty.has('itinerary')}
						saving={savingSection === 'itinerary'}
						error={errors.itinerary}
						success={success.itinerary}
						onSave={() => saveSection('itinerary')}
						sourceBadge={sectionSource('itinerary')}
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
						saving={savingSection === 'rsvp'}
						error={errors.rsvp}
						success={success.rsvp}
						onSave={() => saveSection('rsvp')}
						sourceBadge={sectionSource('rsvp')}
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
							<Field
								label="WhatsApp"
								value={rsvp.whatsappPhone ?? ''}
								onChange={(value) => updateRsvp({ whatsappPhone: value })}
							/>
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
						saving={savingSection === 'music'}
						error={errors.music}
						success={success.music}
						onSave={() => saveSection('music')}
						sourceBadge={sectionSource('music')}
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
						saving={savingSection === 'gifts'}
						error={errors.gifts}
						success={success.gifts}
						onSave={() => saveSection('gifts')}
						sourceBadge={sectionSource('gifts')}
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
											{index + 1}. {GIFT_TYPE_LABELS[item.type] ?? item.type}
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
						id="messages"
						title="Mensajes especiales"
						description="Frase y cierre de agradecimiento."
						dirty={dirty.has('messages')}
						saving={savingSection === 'messages'}
						error={errors.messages}
						success={success.messages}
						onSave={() => saveSection('messages')}
						sourceBadge={sectionSource('messages')}
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
					</SectionCard>

					<SectionCard
						id="gallery"
						title="Galería"
						description="Fotografías, orden, pies de foto y punto focal. Se guardan juntas."
						dirty={dirty.has('gallery')}
						saving={savingSection === 'gallery'}
						error={errors.gallery}
						success={success.gallery}
						onSave={() => saveSection('gallery')}
						sourceBadge={sectionSource('gallery')}
					>
						<GalleryEditor
							value={content.gallery ?? { items: [] }}
							previewSlug={editor.context.invitation.snapshot.previewSlug}
							variant={editor.context.invitation.themeId}
							invitationId={editor.context.invitation.id}
							onChange={(value) => updateContent('gallery', value)}
							photoNotes={photoNotes}
							onPhotoNotesChange={(value) => updateContent('photoNotes', value)}
							onSavePhotoNotes={() => void saveSection('photoNotes')}
							photoNotesDirty={dirty.has('photoNotes')}
							savingPhotoNotes={savingSection === 'photoNotes'}
						/>
					</SectionCard>

					<SectionCard
						id="publication"
						title="Publicación"
						description="Orden público, versión vigente y salud del evento RSVP."
						dirty={dirty.has('publication')}
						saving={savingSection === 'publication'}
						error={errors.publication}
						success={success.publication}
						onSave={() => saveSection('publication')}
						sourceBadge={sectionSource('publication')}
					>
						<PublicationSection
							context={editor.context}
							sectionOrder={sectionOrder}
							onChange={(value) => updateContent('sectionOrder', value)}
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
					>
						<AssetLibraryPanel invitationId={editor.context.invitation.id} />
					</SectionCard>
				</main>
				<EditorPreviewPane
					paneRef={previewPaneRef}
					invitationId={editor.context.invitation.id}
					hasUnsavedChanges={dirty.size > 0}
					previewVersion={previewVersion}
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
					invitationId={editor.context.invitation.id}
					onSelect={(assetId) => {
						if (pickerField === 'hero.backgroundImage') {
							updateHero({ backgroundImage: { type: 'uploaded' as const, assetId } });
						} else if (pickerField === 'hero.portrait') {
							updateHero({ portrait: { type: 'uploaded' as const, assetId } });
						}
						setPickerField(null);
					}}
					onClose={() => setPickerField(null)}
				/>
			)}
		</div>
	);
}
