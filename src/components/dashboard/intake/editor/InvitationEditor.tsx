import { useCallback, useEffect, useState, type ReactNode } from 'react';
import GalleryEditor from '@/components/dashboard/intake/editor/GalleryEditor';
import ItineraryEditor from '@/components/dashboard/intake/editor/ItineraryEditor';
import MetadataSection from '@/components/dashboard/intake/editor/MetadataSection';
import PublicationSection from '@/components/dashboard/intake/editor/PublicationSection';
import type {
	InvitationEditorContextDTO,
	InvitationEditorMetadata,
} from '@/lib/dashboard/dto/intake';
import { useInvitationEditor } from '@/hooks/use-invitation-editor';
import type { InvitationEditorSectionKey } from '@/lib/intake/schemas/invitation-editor.schema';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { toErrorMessage } from '@/lib/rsvp/core/errors';
import { CONTENT_SECTION_KEYS } from '@/lib/theme/theme-contract';

interface Props {
	initialContext: InvitationEditorContextDTO;
}

const NAV_ITEMS: Array<{ id: string; label: string }> = [
	{ id: 'metadata', label: 'Datos de la invitación' },
	{ id: 'main', label: 'Datos principales' },
	{ id: 'family', label: 'Personas principales' },
	{ id: 'location', label: 'Fecha y ubicaciones' },
	{ id: 'itinerary', label: 'Programa' },
	{ id: 'rsvp', label: 'Confirmación de asistencia' },
	{ id: 'music', label: 'Música' },
	{ id: 'gifts', label: 'Mesa de regalos' },
	{ id: 'messages', label: 'Mensajes especiales' },
	{ id: 'gallery', label: 'Galería' },
	{ id: 'photoNotes', label: 'Notas de fotografías' },
	{ id: 'publication', label: 'Publicación' },
];

function SectionCard({
	id,
	title,
	description,
	children,
	dirty,
	saving,
	error,
	success,
	onSave,
}: {
	id: string;
	title: string;
	description: string;
	children: ReactNode;
	dirty: boolean;
	saving: boolean;
	error?: string;
	success?: string;
	onSave: () => void;
}) {
	return (
		<section className="invitation-editor__card" id={id}>
			<div className="invitation-editor__card-header">
				<div>
					<h2>{title}</h2>
					<p>{description}</p>
				</div>
				{dirty && <span className="invitation-editor__dirty">Cambios sin guardar</span>}
			</div>
			{children}
			<div className="invitation-editor__card-footer" aria-live="polite">
				<div>
					{error && <p className="invitation-editor__error">{error}</p>}
					{success && <p className="invitation-editor__success">{success}</p>}
				</div>
				<button type="button" onClick={onSave} disabled={!dirty || saving}>
					{saving ? 'Guardando...' : 'Guardar sección'}
				</button>
			</div>
		</section>
	);
}

function Field({
	label,
	value,
	onChange,
	type = 'text',
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: 'text' | 'email' | 'url' | 'date' | 'datetime-local' | 'time' | 'number';
	placeholder?: string;
}) {
	return (
		<label className="invitation-editor__field">
			<span>{label}</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

function TextArea({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="invitation-editor__field">
			<span>{label}</span>
			<textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}

function metadataFromContext(context: InvitationEditorContextDTO): InvitationEditorMetadata {
	const { title, slug, status, clientName, clientEmail, clientWhatsapp, photosReceived } =
		context.invitation;
	return { title, slug, status, clientName, clientEmail, clientWhatsapp, photosReceived };
}

// eslint-disable-next-line complexity -- The shell coordinates dirty state across intentionally independent cards.
export default function InvitationEditor({ initialContext }: Props) {
	const editor = useInvitationEditor(initialContext);
	const [content, setContent] = useState(editor.context.content);
	const [metadata, setMetadata] = useState(() => metadataFromContext(initialContext));
	const [dirty, setDirty] = useState<Set<string>>(new Set());
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [success, setSuccess] = useState<Record<string, string>>({});

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
		const section =
			key === 'title' || key === 'description' || key === 'hero'
				? 'main'
				: key === 'quote' || key === 'thankYou'
					? 'messages'
					: key === 'sectionOrder'
						? 'publication'
						: key;
		markDirty(String(section));
	};

	const sectionValue = useCallback(
		(section: InvitationEditorSectionKey): unknown => {
			if (section === 'main') {
				return {
					title: content.title,
					description: content.description,
					hero: content.hero ?? {},
				};
			}
			if (section === 'messages') return { quote: content.quote, thankYou: content.thankYou };
			if (section === 'publication') return { sectionOrder: content.sectionOrder ?? [] };
			return content[section as keyof DraftContent] ?? {};
		},
		[content],
	);

	const saveSection = async (section: InvitationEditorSectionKey) => {
		setErrors((current) => ({ ...current, [section]: '' }));
		try {
			await editor.saveSection(section, sectionValue(section));
			setDirty((current) => {
				const next = new Set(current);
				next.delete(section);
				return next;
			});
			setSuccess((current) => ({ ...current, [section]: 'Sección guardada.' }));
		} catch (error) {
			setErrors((current) => ({
				...current,
				[section]: toErrorMessage(error, 'No se pudo guardar la sección.'),
			}));
		}
	};

	const saveMetadata = async () => {
		setErrors((current) => ({ ...current, metadata: '' }));
		try {
			const invitation = await editor.saveMetadata(metadata);
			setMetadata(metadataFromContext({ ...editor.context, invitation }));
			setDirty((current) => {
				const next = new Set(current);
				next.delete('metadata');
				return next;
			});
			setSuccess((current) => ({ ...current, metadata: 'Datos guardados.' }));
		} catch (error) {
			setErrors((current) => ({
				...current,
				metadata: toErrorMessage(error, 'No se pudieron guardar los datos.'),
			}));
		}
	};

	const publish = async () => {
		setErrors((current) => ({ ...current, publish: '' }));
		try {
			await editor.publish();
			setSuccess((current) => ({ ...current, publish: 'Cambios publicados correctamente.' }));
		} catch (error) {
			setErrors((current) => ({
				...current,
				publish: toErrorMessage(error, 'No se pudieron publicar los cambios.'),
			}));
		}
	};

	const main = content.hero ?? {};
	const family = content.family ?? {};
	const location = content.location ?? {};
	const rsvp = content.rsvp ?? {};
	const music = content.music ?? {};
	const gifts = content.gifts ?? { items: [] };
	const messages = { quote: content.quote ?? {}, thankYou: content.thankYou ?? {} };
	const photoNotes = content.photoNotes ?? {};
	const sectionOrder = content.sectionOrder ?? [...CONTENT_SECTION_KEYS];
	const hasDirtySections = dirty.size > 0;

	const updateGiftItem = (index: number, patch: Record<string, unknown>) => {
		updateContent('gifts', {
			...gifts,
			items: (gifts.items ?? []).map((item, i) =>
				i === index ? { ...item, ...patch } : item,
			),
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

	const cards = { saving: editor.savingSection };

	return (
		<div className="invitation-editor">
			<header className="invitation-editor__header">
				<div>
					<p className="invitation-editor__eyebrow">Editor interno</p>
					<h1>{metadata.title}</h1>
					<p>
						{editor.context.publication.hasUnpublishedChanges
							? 'Hay una revisión sin publicar.'
							: 'La versión pública está actualizada.'}
					</p>
				</div>
				<div className="invitation-editor__header-actions">
					<a href={`/dashboard/invitaciones/${editor.context.invitation.id}/preview`}>
						Vista previa
					</a>
					<button
						type="button"
						onClick={publish}
						disabled={editor.publishing || hasDirtySections}
					>
						{editor.publishing ? 'Publicando...' : 'Publicar cambios'}
					</button>
				</div>
				{errors.publish && <p className="invitation-editor__error">{errors.publish}</p>}
				{success.publish && <p className="invitation-editor__success">{success.publish}</p>}
			</header>

			<div className="invitation-editor__layout">
				<nav className="invitation-editor__nav" aria-label="Secciones del editor">
					{NAV_ITEMS.map((item) => (
						<a href={`#${item.id}`} key={item.id}>
							{item.label}
							{dirty.has(item.id) && (
								<span aria-label="con cambios sin guardar"> *</span>
							)}
						</a>
					))}
				</nav>

				<main className="invitation-editor__content">
					<SectionCard
						id="metadata"
						title="Datos de la invitación"
						description="Información administrativa, URL pública y seguimiento de producción."
						dirty={dirty.has('metadata')}
						saving={cards.saving === 'metadata'}
						error={errors.metadata}
						success={success.metadata}
						onSave={saveMetadata}
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
						saving={cards.saving === 'main'}
						error={errors.main}
						success={success.main}
						onSave={() => saveSection('main')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título público"
								value={content.title ?? ''}
								onChange={(value) => updateContent('title', value)}
							/>
							<Field
								label="Nombre principal"
								value={main.name ?? ''}
								onChange={(value) => updateHero({ name: value })}
							/>
							<Field
								label="Segundo nombre"
								value={main.secondaryName ?? ''}
								onChange={(value) => updateHero({ secondaryName: value })}
							/>
							<Field
								label="Etiqueta del evento"
								value={main.label ?? ''}
								onChange={(value) => updateHero({ label: value })}
							/>
							<Field
								label="Apodo"
								value={main.nickname ?? ''}
								onChange={(value) => updateHero({ nickname: value })}
							/>
							<Field
								label="Fecha"
								type="datetime-local"
								value={(main.date ?? '').replace('Z', '').slice(0, 16)}
								onChange={(value) => updateHero({ date: value })}
							/>
						</div>
						<TextArea
							label="Descripción"
							value={content.description ?? ''}
							onChange={(value) => updateContent('description', value)}
						/>
					</SectionCard>

					<SectionCard
						id="family"
						title="Personas principales"
						description="Familia y personas destacadas."
						dirty={dirty.has('family')}
						saving={cards.saving === 'family'}
						error={errors.family}
						success={success.family}
						onSave={() => saveSection('family')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Papá"
								value={family.fatherName ?? ''}
								onChange={(value) => updateFamily({ fatherName: value })}
							/>
							<Field
								label="Mamá"
								value={family.motherName ?? ''}
								onChange={(value) => updateFamily({ motherName: value })}
							/>
							<Field
								label="Pareja"
								value={family.spouseName ?? ''}
								onChange={(value) => updateFamily({ spouseName: value })}
							/>
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
							label="Padrinos, uno por línea"
							value={family.godparents ?? ''}
							onChange={(value) => updateFamily({ godparents: value })}
						/>
						<TextArea
							label="Hijos, uno por línea"
							value={family.children ?? ''}
							onChange={(value) => updateFamily({ children: value })}
						/>
						<TextArea
							label="Mensaje familiar"
							value={family.sectionMessage ?? ''}
							onChange={(value) => updateFamily({ sectionMessage: value })}
						/>
					</SectionCard>

					<SectionCard
						id="location"
						title="Fecha y ubicaciones"
						description="Ceremonia, recepción e indicaciones."
						dirty={dirty.has('location')}
						saving={cards.saving === 'location'}
						error={errors.location}
						success={success.location}
						onSave={() => saveSection('location')}
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
						saving={cards.saving === 'itinerary'}
						error={errors.itinerary}
						success={success.itinerary}
						onSave={() => saveSection('itinerary')}
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
						saving={cards.saving === 'rsvp'}
						error={errors.rsvp}
						success={success.rsvp}
						onSave={() => saveSection('rsvp')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título"
								value={rsvp.title ?? ''}
								onChange={(value) => updateRsvp({ title: value })}
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
						saving={cards.saving === 'music'}
						error={errors.music}
						success={success.music}
						onSave={() => saveSection('music')}
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
						saving={cards.saving === 'gifts'}
						error={errors.gifts}
						success={success.gifts}
						onSave={() => saveSection('gifts')}
					>
						<div className="invitation-editor__field-grid">
							<Field
								label="Título"
								value={gifts.title ?? ''}
								onChange={(value) =>
									updateContent('gifts', { ...gifts, title: value })
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
							{(gifts.items ?? []).map((item, index) => (
								<div
									className="invitation-editor__list-item"
									key={`${item.type}-${index}`}
								>
									<div className="invitation-editor__field-grid">
										<Field
											label="Tipo"
											value={item.type}
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
														updateGiftItem(index, { bankName: value })
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
									<button
										type="button"
										className="invitation-editor__link-button"
										onClick={() =>
											updateContent('gifts', {
												...gifts,
												items: (gifts.items ?? []).filter(
													(_, i) => i !== index,
												),
											})
										}
									>
										Eliminar opción
									</button>
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
										...(gifts.items ?? []),
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
						saving={cards.saving === 'messages'}
						error={errors.messages}
						success={success.messages}
						onSave={() => saveSection('messages')}
					>
						<TextArea
							label="Frase"
							value={messages.quote.text ?? ''}
							onChange={(value) =>
								updateContent('quote', { ...messages.quote, text: value })
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
						saving={cards.saving === 'gallery'}
						error={errors.gallery}
						success={success.gallery}
						onSave={() => saveSection('gallery')}
					>
						<GalleryEditor
							value={content.gallery ?? { items: [] }}
							previewSlug={editor.context.invitation.snapshot.previewSlug}
							onChange={(value) => updateContent('gallery', value)}
						/>
					</SectionCard>

					<SectionCard
						id="photoNotes"
						title="Notas de fotografías"
						description="Notas internas de producción; no se publican."
						dirty={dirty.has('photoNotes')}
						saving={cards.saving === 'photoNotes'}
						error={errors.photoNotes}
						success={success.photoNotes}
						onSave={() => saveSection('photoNotes')}
					>
						<label className="invitation-editor__check">
							<input
								type="checkbox"
								checked={photoNotes.whatsappSent ?? false}
								onChange={(event) =>
									updateContent('photoNotes', {
										...photoNotes,
										whatsappSent: event.target.checked,
									})
								}
							/>
							<span>Material enviado por WhatsApp</span>
						</label>
						{(
							[
								['heroPhoto', 'Portada'],
								['portraitPhoto', 'Retrato'],
								['galleryPhotos', 'Galería'],
								['familyPhoto', 'Familia'],
								['specialPhoto', 'Especial'],
								['generalNotes', 'Notas generales'],
								['photoOrder', 'Orden'],
								['cropNotes', 'Recortes'],
								['priorityNotes', 'Prioridades'],
							] as const
						).map(([key, label]) => (
							<TextArea
								key={key}
								label={label}
								value={photoNotes[key] ?? ''}
								onChange={(value) =>
									updateContent('photoNotes', { ...photoNotes, [key]: value })
								}
							/>
						))}
					</SectionCard>

					<SectionCard
						id="publication"
						title="Publicación"
						description="Orden público, versión vigente y salud del evento RSVP."
						dirty={dirty.has('publication')}
						saving={cards.saving === 'publication'}
						error={errors.publication}
						success={success.publication}
						onSave={() => saveSection('publication')}
					>
						<PublicationSection
							context={editor.context}
							sectionOrder={sectionOrder}
							onChange={(value) => updateContent('sectionOrder', value)}
							reconciling={editor.reconciling}
							onReconcile={() => void editor.reconcileRsvp()}
						/>
					</SectionCard>
				</main>
			</div>
		</div>
	);
}
