import type { FC } from 'react';
import { useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { strFallback, boolFallback, numFallback, moveArrayItem } from '@/lib/shared/data-utils';
import { SECTION_LABELS } from '@/lib/intake/labels';
import { CONTENT_SECTION_KEYS, type ContentSectionKey } from '@/lib/theme/theme-contract';
import { DEFAULT_ICON, type IconName } from '@/lib/icons/icon-catalog';

interface Props {
	invitationId: string;
	initialContent: DraftContent;
	onCancel: () => void;
}

interface ValidationError {
	section: string;
	field: string;
	message: string;
}

function validateContent(content: DraftContent): ValidationError[] {
	const errors: ValidationError[] = [];
	const hero = (content.hero ?? {}) as Record<string, unknown>;
	const rsvp = (content.rsvp ?? {}) as Record<string, unknown>;
	const quote = (content.quote ?? {}) as Record<string, unknown>;
	const thankYou = (content.thankYou ?? {}) as Record<string, unknown>;

	if (!strFallback(content.title)) {
		errors.push({ section: 'Hero', field: 'title', message: 'El título es obligatorio.' });
	}
	if (!strFallback(hero.name)) {
		errors.push({
			section: 'Hero',
			field: 'name',
			message: 'El nombre del festejado es obligatorio.',
		});
	}
	if (!strFallback(hero.label)) {
		errors.push({
			section: 'Hero',
			field: 'label',
			message: 'El título del evento es obligatorio.',
		});
	}
	if (!strFallback(quote.text)) {
		errors.push({
			section: 'quote',
			field: 'text',
			message: 'La frase de apertura es obligatoria.',
		});
	}
	if (!strFallback(thankYou.message)) {
		errors.push({
			section: 'thankYou',
			field: 'message',
			message: 'El mensaje de agradecimiento es obligatorio.',
		});
	}
	if (!strFallback(rsvp.title)) {
		errors.push({
			section: 'rsvp',
			field: 'title',
			message: 'El título de RSVP es obligatorio.',
		});
	}

	return errors;
}

const DraftEditor: FC<Props> = ({ invitationId, initialContent, onCancel }) => {
	const { updateDraft, saving } = useInvitationAdmin();
	const [content, setContent] = useState<DraftContent>(() => structuredClone(initialContent));
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

	const setField = (section: string, field: string, value: unknown) => {
		setContent((prev) => {
			const sectionData = {
				...(((prev as Record<string, unknown>)[section] as Record<string, unknown>) ?? {}),
			};
			sectionData[field] = value;
			return { ...prev, [section]: sectionData };
		});
		setValidationErrors([]);
		setSuccess('');
	};

	const setTopField = (field: string, value: unknown) => {
		setContent((prev) => ({ ...prev, [field]: value }));
		setValidationErrors([]);
		setSuccess('');
	};

	const handleSave = async () => {
		const errors = validateContent(content);
		setValidationErrors(errors);
		if (errors.length > 0) {
			setError('Corrige los campos marcados antes de guardar.');
			return;
		}

		setError('');
		setSuccess('');
		try {
			await updateDraft(invitationId, content as Record<string, unknown>);
			setSuccess('Borrador guardado exitosamente.');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar el borrador.');
		}
	};

	const handleCancel = () => {
		if (!success) {
			setContent(structuredClone(initialContent));
			setError('');
			setSuccess('');
			setValidationErrors([]);
		}
		onCancel();
	};

	const hero = content.hero ?? {};
	const family = content.family ?? {};
	const location = content.location ?? {};
	const rsvp = content.rsvp ?? {};
	const music = content.music ?? {};
	const gifts = content.gifts ?? {};
	const quote = content.quote ?? {};
	const thankYou = content.thankYou ?? {};
	const photoNotes = content.photoNotes ?? {};
	const sectionOrder = (content.sectionOrder ?? [...CONTENT_SECTION_KEYS]).filter(
		(section): section is ContentSectionKey =>
			(CONTENT_SECTION_KEYS as readonly string[]).includes(section),
	);

	const setSectionOrder = (nextOrder: ContentSectionKey[]) => {
		setContent((prev) => ({ ...prev, sectionOrder: nextOrder }));
		setSuccess('');
	};

	const toggleSection = (section: ContentSectionKey) => {
		setSectionOrder(
			sectionOrder.includes(section)
				? sectionOrder.filter((item) => item !== section)
				: [...sectionOrder, section],
		);
	};

	const moveSection = (section: ContentSectionKey, offset: -1 | 1) => {
		const index = sectionOrder.indexOf(section);
		if (index === -1) return;
		const nextOrder = moveArrayItem(sectionOrder, index, offset);
		if (nextOrder === sectionOrder) return;
		setSectionOrder(nextOrder);
	};

	const getErrors = (section: string): ValidationError[] =>
		validationErrors.filter((e) => e.section === section);

	const renderField = (
		section: string,
		fieldKey: string,
		label: string,
		value: string,
		onChange: (v: string) => void,
		type: 'text' | 'textarea' = 'text',
		rows?: number,
	) => {
		const sectionErrors = getErrors(section);
		const hasError = sectionErrors.some((e) => e.field === fieldKey);

		return (
			<div
				className={`intake-editor__field${hasError ? ' intake-editor__field--error' : ''}`}
			>
				<label className="intake-field__label">{label}</label>
				{type === 'textarea' ? (
					<textarea
						className="intake-field__textarea"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						rows={rows ?? 2}
					/>
				) : (
					<input
						className="intake-field__input"
						type="text"
						value={value}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
				{hasError && (
					<p className="intake-field__error">
						{sectionErrors.find((e) => e.field === fieldKey)?.message}
					</p>
				)}
			</div>
		);
	};

	return (
		<div className="intake-editor">
			{error && <p className="intake-review__error">{error}</p>}
			{success && <p className="intake-review__success">{success}</p>}

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Secciones visibles</h3>
				<p className="intake-editor__section-desc">
					Activa, desactiva o cambia el orden de las secciones de la invitación.
				</p>
				{CONTENT_SECTION_KEYS.map((section) => {
					const enabled = sectionOrder.includes(section);
					const index = sectionOrder.indexOf(section);
					return (
						<div key={section} className="intake-editor__field">
							<label className="intake-field__label">
								<input
									type="checkbox"
									className="intake-editor__checkbox"
									checked={enabled}
									onChange={() => toggleSection(section)}
								/>
								{SECTION_LABELS[section] ?? section}
							</label>
							{enabled && (
								<div>
									<button
										type="button"
										className="intake-review__btn"
										onClick={() => moveSection(section, -1)}
										disabled={index === 0}
									>
										Subir
									</button>
									<button
										type="button"
										className="intake-review__btn"
										onClick={() => moveSection(section, 1)}
										disabled={index === sectionOrder.length - 1}
									>
										Bajar
									</button>
								</div>
							)}
						</div>
					);
				})}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.Hero}</h3>
				<p className="intake-editor__section-desc">
					Información principal de la invitación.
				</p>
				{renderField('Hero', 'title', 'Título', content.title ?? '', (v) =>
					setTopField('title', v),
				)}
				{renderField(
					'Hero',
					'description',
					'Descripción',
					content.description ?? '',
					(v) => setTopField('description', v),
					'textarea',
				)}
				{renderField('Hero', 'name', 'Nombre del festejado', strFallback(hero.name), (v) =>
					setField('hero', 'name', v),
				)}
				{renderField(
					'Hero',
					'secondaryName',
					'Segundo nombre',
					strFallback(hero.secondaryName),
					(v) => setField('hero', 'secondaryName', v),
				)}
				{renderField('Hero', 'label', 'Título del evento', strFallback(hero.label), (v) =>
					setField('hero', 'label', v),
				)}
				{renderField('Hero', 'nickname', 'Apodo', strFallback(hero.nickname), (v) =>
					setField('hero', 'nickname', v),
				)}
				{renderField('Hero', 'date', 'Fecha del evento', strFallback(hero.date), (v) =>
					setField('hero', 'date', v),
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.family}</h3>
				<p className="intake-editor__section-desc">Padres, padrinos, cónyuge e hijos.</p>
				<div className="intake-editor__field">
					<label className="intake-field__label">
						<input
							type="checkbox"
							className="intake-editor__checkbox"
							checked={family.visible !== false}
							onChange={(e) => setField('family', 'visible', e.target.checked)}
						/>
						Mostrar sección de familia
					</label>
				</div>
				{renderField(
					'family',
					'sectionSubtitle',
					'Encabezado de sección',
					strFallback(family.sectionSubtitle),
					(v) => setField('family', 'sectionSubtitle', v),
				)}
				{renderField(
					'family',
					'sectionTitle',
					'Título de sección',
					strFallback(family.sectionTitle),
					(v) => setField('family', 'sectionTitle', v),
				)}
				{renderField(
					'family',
					'parentsTitle',
					'Título de padres',
					strFallback(family.parentsTitle),
					(v) => setField('family', 'parentsTitle', v),
				)}
				{renderField(
					'family',
					'godparentsTitle',
					'Título de padrinos',
					strFallback(family.godparentsTitle),
					(v) => setField('family', 'godparentsTitle', v),
				)}
				{renderField(
					'family',
					'fatherName',
					'Nombre del padre',
					strFallback(family.fatherName),
					(v) => setField('family', 'fatherName', v),
				)}
				<div className="intake-editor__field">
					<label className="intake-field__label">
						<input
							type="checkbox"
							className="intake-editor__checkbox"
							checked={boolFallback(family.fatherDeceased)}
							onChange={(e) => setField('family', 'fatherDeceased', e.target.checked)}
						/>
						Padre fallecido
					</label>
				</div>
				{renderField(
					'family',
					'motherName',
					'Nombre de la madre',
					strFallback(family.motherName),
					(v) => setField('family', 'motherName', v),
				)}
				<div className="intake-editor__field">
					<label className="intake-field__label">
						<input
							type="checkbox"
							className="intake-editor__checkbox"
							checked={boolFallback(family.motherDeceased)}
							onChange={(e) => setField('family', 'motherDeceased', e.target.checked)}
						/>
						Madre fallecida
					</label>
				</div>
				{renderField(
					'family',
					'spouseName',
					'Nombre del cónyuge',
					strFallback(family.spouseName),
					(v) => setField('family', 'spouseName', v),
				)}
				{renderField(
					'family',
					'godparents',
					'Padrinos (uno por línea)',
					strFallback(family.godparents),
					(v) => setField('family', 'godparents', v),
					'textarea',
					3,
				)}
				{renderField(
					'family',
					'children',
					'Hijos (uno por línea)',
					strFallback(family.children),
					(v) => setField('family', 'children', v),
					'textarea',
					3,
				)}
				{renderField(
					'family',
					'sectionMessage',
					'Mensaje familiar',
					strFallback(family.sectionMessage),
					(v) => setField('family', 'sectionMessage', v),
					'textarea',
					2,
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.location}</h3>
				<p className="intake-editor__section-desc">
					Ceremonia, recepción, código de vestimenta.
				</p>
				{['ceremony', 'reception'].map((venueKey) => {
					const venue = content.location?.[venueKey as keyof typeof location] as
						| Record<string, unknown>
						| undefined;
					const label = venueKey === 'ceremony' ? 'Ceremonia' : 'Recepción';
					return (
						<div key={venueKey} className="intake-editor__venue">
							<h4 className="intake-review__venue-title">{label}</h4>
							{renderField(
								'location',
								'venueName',
								'Nombre del lugar',
								strFallback(venue?.venueName),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										venueName: v,
									};
									setField('location', venueKey, updated);
								},
							)}
							{renderField(
								'location',
								'address',
								'Dirección',
								strFallback(venue?.address),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										address: v,
									};
									setField('location', venueKey, updated);
								},
							)}
							{renderField(
								'location',
								'city',
								'Ciudad',
								strFallback(venue?.city),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										city: v,
									};
									setField('location', venueKey, updated);
								},
							)}
							{renderField(
								'location',
								'date',
								'Fecha',
								strFallback(venue?.date),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										date: v,
									};
									setField('location', venueKey, updated);
								},
							)}
							{renderField(
								'location',
								'time',
								'Hora',
								strFallback(venue?.time),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										time: v,
									};
									setField('location', venueKey, updated);
								},
							)}
							{renderField(
								'location',
								'mapUrl',
								'URL del mapa',
								strFallback(venue?.mapUrl),
								(v) => {
									const updated = {
										...(((location as Record<string, unknown>)[
											venueKey
										] as Record<string, unknown>) ?? {}),
										mapUrl: v,
									};
									setField('location', venueKey, updated);
								},
							)}
						</div>
					);
				})}
				<h4 className="intake-editor__subsection-title">Indicaciones</h4>
				{Array.isArray(location.indications) && location.indications.length > 0
					? location.indications.map((indication, idx) => (
							<div key={idx} className="intake-editor__indication-row">
								<label className="intake-editor__field">
									<span>Texto</span>
									<input
										className="intake-field__input"
										value={indication.text}
										onChange={(e) => {
											const updated = (location.indications ?? []).map(
												(item, i) =>
													i === idx
														? { ...item, text: e.target.value }
														: item,
											);
											setField('location', 'indications', updated);
										}}
									/>
								</label>
								<button
									type="button"
									className="intake-editor__remove-button"
									onClick={() => {
										const updated = (location.indications ?? []).filter(
											(_, i) => i !== idx,
										);
										setField('location', 'indications', updated);
									}}
								>
									Eliminar
								</button>
							</div>
						))
					: null}
				<button
					type="button"
					className="intake-editor__add-button"
					onClick={() => {
						const current = location.indications ?? [];
						setField('location', 'indications', [
							...current,
							{ iconName: DEFAULT_ICON as IconName, text: '' },
						]);
					}}
				>
					+ Agregar indicación
				</button>
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.rsvp}</h3>
				<p className="intake-editor__section-desc">
					Configuración de confirmación de asistencia.
				</p>
				{renderField('rsvp', 'title', 'Título', strFallback(rsvp.title), (v) =>
					setField('rsvp', 'title', v),
				)}
				<div className="intake-editor__field">
					<label className="intake-field__label">Acompañantes máximo</label>
					<input
						className="intake-field__input"
						type="number"
						value={numFallback(rsvp.guestCap)}
						onChange={(e) => setField('rsvp', 'guestCap', Number(e.target.value))}
						min={0}
					/>
				</div>
				{renderField(
					'rsvp',
					'confirmationMessage',
					'Mensaje de confirmación',
					strFallback(rsvp.confirmationMessage),
					(v) => setField('rsvp', 'confirmationMessage', v),
					'textarea',
					2,
				)}
				{renderField(
					'rsvp',
					'confirmationMode',
					'Modo de confirmación',
					strFallback(rsvp.confirmationMode),
					(v) => setField('rsvp', 'confirmationMode', v),
				)}
				{renderField(
					'rsvp',
					'whatsappPhone',
					'WhatsApp',
					strFallback(rsvp.whatsappPhone),
					(v) => setField('rsvp', 'whatsappPhone', v),
				)}
				{renderField(
					'rsvp',
					'subcopy',
					'Texto adicional',
					strFallback(rsvp.subcopy),
					(v) => setField('rsvp', 'subcopy', v),
					'textarea',
					2,
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.music}</h3>
				<p className="intake-editor__section-desc">Canción de fondo para la invitación.</p>
				{renderField('music', 'url', 'URL de la canción', strFallback(music.url), (v) =>
					setField('music', 'url', v),
				)}
				{renderField(
					'music',
					'title',
					'Título de la canción',
					strFallback(music.title),
					(v) => setField('music', 'title', v),
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.gifts}</h3>
				<p className="intake-editor__section-desc">Información de mesa de regalos.</p>
				{renderField('gifts', 'title', 'Título', strFallback(gifts.title), (v) =>
					setField('gifts', 'title', v),
				)}
				{renderField(
					'gifts',
					'subtitle',
					'Subtítulo',
					strFallback(gifts.subtitle),
					(v) => setField('gifts', 'subtitle', v),
					'textarea',
					2,
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.quote}</h3>
				<p className="intake-editor__section-desc">Frase de apertura y agradecimiento.</p>
				{renderField(
					'quote',
					'text',
					'Frase de apertura',
					strFallback(quote.text),
					(v) => setField('quote', 'text', v),
					'textarea',
					2,
				)}
				{renderField('quote', 'author', 'Autor', strFallback(quote.author), (v) =>
					setField('quote', 'author', v),
				)}
				<h4 className="intake-review__venue-title">{SECTION_LABELS.thankYou}</h4>
				{renderField(
					'thankYou',
					'message',
					'Mensaje de agradecimiento',
					strFallback(thankYou.message),
					(v) => setField('thankYou', 'message', v),
					'textarea',
					2,
				)}
				{renderField(
					'thankYou',
					'closingName',
					'Nombre de despedida',
					strFallback(thankYou.closingName),
					(v) => setField('thankYou', 'closingName', v),
				)}
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.photoNotes}</h3>
				<p className="intake-editor__section-desc">
					Notas sobre las fotografías para el diseñador.
				</p>
				<div className="intake-editor__field">
					<label className="intake-field__label">Fotos enviadas por WhatsApp</label>
					<input
						type="checkbox"
						className="intake-editor__checkbox"
						checked={boolFallback(photoNotes.whatsappSent)}
						onChange={(e) => setField('photoNotes', 'whatsappSent', e.target.checked)}
					/>
				</div>
				{renderField(
					'photoNotes',
					'heroPhoto',
					'Foto principal',
					strFallback(photoNotes.heroPhoto),
					(v) => setField('photoNotes', 'heroPhoto', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'portraitPhoto',
					'Retrato',
					strFallback(photoNotes.portraitPhoto),
					(v) => setField('photoNotes', 'portraitPhoto', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'galleryPhotos',
					'Fotos de galería',
					strFallback(photoNotes.galleryPhotos),
					(v) => setField('photoNotes', 'galleryPhotos', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'familyPhoto',
					'Foto familiar',
					strFallback(photoNotes.familyPhoto),
					(v) => setField('photoNotes', 'familyPhoto', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'specialPhoto',
					'Foto especial',
					strFallback(photoNotes.specialPhoto),
					(v) => setField('photoNotes', 'specialPhoto', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'generalNotes',
					'Notas generales',
					strFallback(photoNotes.generalNotes),
					(v) => setField('photoNotes', 'generalNotes', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'photoOrder',
					'Orden sugerido',
					strFallback(photoNotes.photoOrder),
					(v) => setField('photoNotes', 'photoOrder', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'cropNotes',
					'Notas de recorte',
					strFallback(photoNotes.cropNotes),
					(v) => setField('photoNotes', 'cropNotes', v),
					'textarea',
					2,
				)}
				{renderField(
					'photoNotes',
					'priorityNotes',
					'Prioridad',
					strFallback(photoNotes.priorityNotes),
					(v) => setField('photoNotes', 'priorityNotes', v),
					'textarea',
					2,
				)}
			</section>

			<div className="intake-review__actions">
				<div className="intake-review__buttons">
					{success ? (
						<button
							type="button"
							className="intake-review__btn intake-review__btn--approve"
							onClick={onCancel}
						>
							Cerrar
						</button>
					) : (
						<>
							<button
								type="button"
								className="intake-review__btn intake-review__btn--approve"
								onClick={handleSave}
								disabled={saving}
							>
								{saving ? 'Guardando...' : 'Guardar cambios'}
							</button>
							<button
								type="button"
								className="intake-review__btn intake-review__btn--changes"
								onClick={handleCancel}
								disabled={saving}
							>
								Cancelar
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default DraftEditor;
