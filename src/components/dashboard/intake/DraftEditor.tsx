import type { FC } from 'react';
import { Fragment, useCallback, useState } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { strFallback, boolFallback, numFallback, moveArrayItem } from '@/lib/shared/data-utils';
import { SECTION_LABELS } from '@/lib/intake/labels';
import { CONTENT_SECTION_KEYS, type ContentSectionKey } from '@/lib/theme/theme-contract';
import { DEFAULT_ICON, type IconName } from '@/lib/icons/icon-catalog';
import { validateDraftContent } from '@/lib/intake/validation/validate-draft-content';
import type { ValidationError } from '@/lib/intake/validation/validate-draft-content';
import FormField from '@/components/dashboard/intake/FormField';

interface Props {
	invitationId: string;
	initialContent: DraftContent;
	onCancel: () => void;
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

	const handleSave = useCallback(async () => {
		const errors = validateDraftContent(content);
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
	}, [content, invitationId, updateDraft]);

	const handleCancel = useCallback(() => {
		if (!success) {
			setContent(structuredClone(initialContent));
			setError('');
			setSuccess('');
			setValidationErrors([]);
		}
		onCancel();
	}, [success, initialContent, onCancel]);

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
				<FormField
					section="hero"
					fieldKey="title"
					label="Título"
					value={content.title ?? ''}
					onChange={(v) => setTopField('title', v)}
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="description"
					label="Descripción"
					value={content.description ?? ''}
					onChange={(v) => setTopField('description', v)}
					type="textarea"
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="name"
					label="Nombre del festejado"
					value={strFallback(hero.name)}
					onChange={(v) => setField('hero', 'name', v)}
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="secondaryName"
					label="Segundo nombre"
					value={strFallback(hero.secondaryName)}
					onChange={(v) => setField('hero', 'secondaryName', v)}
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="label"
					label="Título del evento"
					value={strFallback(hero.label)}
					onChange={(v) => setField('hero', 'label', v)}
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="nickname"
					label="Apodo"
					value={strFallback(hero.nickname)}
					onChange={(v) => setField('hero', 'nickname', v)}
					errors={validationErrors}
				/>
				<FormField
					section="hero"
					fieldKey="date"
					label="Fecha del evento"
					value={strFallback(hero.date)}
					onChange={(v) => setField('hero', 'date', v)}
					errors={validationErrors}
				/>
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
				<FormField
					section="family"
					fieldKey="sectionSubtitle"
					label="Encabezado de sección"
					value={strFallback(family.sectionSubtitle)}
					onChange={(v) => setField('family', 'sectionSubtitle', v)}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="sectionTitle"
					label="Título de sección"
					value={strFallback(family.sectionTitle)}
					onChange={(v) => setField('family', 'sectionTitle', v)}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="parentsTitle"
					label="Título de padres"
					value={strFallback(family.parentsTitle)}
					onChange={(v) => setField('family', 'parentsTitle', v)}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="godparentsTitle"
					label="Título de padrinos"
					value={strFallback(family.godparentsTitle)}
					onChange={(v) => setField('family', 'godparentsTitle', v)}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="fatherName"
					label="Nombre del padre"
					value={strFallback(family.fatherName)}
					onChange={(v) => setField('family', 'fatherName', v)}
					errors={validationErrors}
				/>
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
				<FormField
					section="family"
					fieldKey="motherName"
					label="Nombre de la madre"
					value={strFallback(family.motherName)}
					onChange={(v) => setField('family', 'motherName', v)}
					errors={validationErrors}
				/>
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
				<FormField
					section="family"
					fieldKey="spouseName"
					label="Nombre del cónyuge"
					value={strFallback(family.spouseName)}
					onChange={(v) => setField('family', 'spouseName', v)}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="godparents"
					label="Padrinos (uno por línea)"
					value={strFallback(family.godparents)}
					onChange={(v) => setField('family', 'godparents', v)}
					type="textarea"
					rows={3}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="children"
					label="Hijos (uno por línea)"
					value={strFallback(family.children)}
					onChange={(v) => setField('family', 'children', v)}
					type="textarea"
					rows={3}
					errors={validationErrors}
				/>
				<FormField
					section="family"
					fieldKey="sectionMessage"
					label="Mensaje familiar"
					value={strFallback(family.sectionMessage)}
					onChange={(v) => setField('family', 'sectionMessage', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.location}</h3>
				<p className="intake-editor__section-desc">
					Ceremonia, recepción, código de vestimenta.
				</p>
				{(
					[
						['ceremony', 'Ceremonia'],
						['reception', 'Recepción'],
					] as const
				).map(([venueKey, venueLabel]) => {
					const venue = content.location?.[venueKey] as
						| Record<string, unknown>
						| undefined;
					const VENUE_FIELDS: Array<{ fieldKey: string; label: string }> = [
						{ fieldKey: 'venueName', label: 'Nombre del lugar' },
						{ fieldKey: 'address', label: 'Dirección' },
						{ fieldKey: 'city', label: 'Ciudad' },
						{ fieldKey: 'date', label: 'Fecha' },
						{ fieldKey: 'time', label: 'Hora' },
						{ fieldKey: 'mapUrl', label: 'URL del mapa' },
					];
					return (
						<div key={venueKey} className="intake-editor__venue">
							<h4 className="intake-review__venue-title">{venueLabel}</h4>
							{VENUE_FIELDS.map(({ fieldKey, label }) => (
								<Fragment key={fieldKey}>
									<FormField
										section="location"
										fieldKey={fieldKey}
										label={label}
										value={strFallback(venue?.[fieldKey])}
										onChange={(v) => {
											const updated = {
												...(((location as Record<string, unknown>)[
													venueKey
												] as Record<string, unknown>) ?? {}),
												[fieldKey]: v,
											};
											setField('location', venueKey, updated);
										}}
										errors={validationErrors}
									/>
								</Fragment>
							))}
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
				<FormField
					section="rsvp"
					fieldKey="title"
					label="Título"
					value={strFallback(rsvp.title)}
					onChange={(v) => setField('rsvp', 'title', v)}
					errors={validationErrors}
				/>
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
				<FormField
					section="rsvp"
					fieldKey="confirmationMessage"
					label="Mensaje de confirmación"
					value={strFallback(rsvp.confirmationMessage)}
					onChange={(v) => setField('rsvp', 'confirmationMessage', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="rsvp"
					fieldKey="confirmationMode"
					label="Modo de confirmación"
					value={strFallback(rsvp.confirmationMode)}
					onChange={(v) => setField('rsvp', 'confirmationMode', v)}
					errors={validationErrors}
				/>
				<FormField
					section="rsvp"
					fieldKey="whatsappPhone"
					label="WhatsApp"
					value={strFallback(rsvp.whatsappPhone)}
					onChange={(v) => setField('rsvp', 'whatsappPhone', v)}
					errors={validationErrors}
				/>
				<FormField
					section="rsvp"
					fieldKey="subcopy"
					label="Texto adicional"
					value={strFallback(rsvp.subcopy)}
					onChange={(v) => setField('rsvp', 'subcopy', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.music}</h3>
				<p className="intake-editor__section-desc">Canción de fondo para la invitación.</p>
				<FormField
					section="music"
					fieldKey="url"
					label="URL de la canción"
					value={strFallback(music.url)}
					onChange={(v) => setField('music', 'url', v)}
					errors={validationErrors}
				/>
				<FormField
					section="music"
					fieldKey="title"
					label="Título de la canción"
					value={strFallback(music.title)}
					onChange={(v) => setField('music', 'title', v)}
					errors={validationErrors}
				/>
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.gifts}</h3>
				<p className="intake-editor__section-desc">Información de mesa de regalos.</p>
				<FormField
					section="gifts"
					fieldKey="title"
					label="Título"
					value={strFallback(gifts.title)}
					onChange={(v) => setField('gifts', 'title', v)}
					errors={validationErrors}
				/>
				<FormField
					section="gifts"
					fieldKey="subtitle"
					label="Subtítulo"
					value={strFallback(gifts.subtitle)}
					onChange={(v) => setField('gifts', 'subtitle', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
			</section>

			<section className="intake-review__section">
				<h3 className="intake-review__section-title">{SECTION_LABELS.quote}</h3>
				<p className="intake-editor__section-desc">Frase de apertura y agradecimiento.</p>
				<FormField
					section="quote"
					fieldKey="text"
					label="Frase de apertura"
					value={strFallback(quote.text)}
					onChange={(v) => setField('quote', 'text', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="quote"
					fieldKey="author"
					label="Autor"
					value={strFallback(quote.author)}
					onChange={(v) => setField('quote', 'author', v)}
					errors={validationErrors}
				/>
				<h4 className="intake-review__venue-title">{SECTION_LABELS.thankYou}</h4>
				<FormField
					section="thankYou"
					fieldKey="message"
					label="Mensaje de agradecimiento"
					value={strFallback(thankYou.message)}
					onChange={(v) => setField('thankYou', 'message', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="thankYou"
					fieldKey="closingName"
					label="Nombre de despedida"
					value={strFallback(thankYou.closingName)}
					onChange={(v) => setField('thankYou', 'closingName', v)}
					errors={validationErrors}
				/>
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
				<FormField
					section="photoNotes"
					fieldKey="heroPhoto"
					label="Foto principal"
					value={strFallback(photoNotes.heroPhoto)}
					onChange={(v) => setField('photoNotes', 'heroPhoto', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="portraitPhoto"
					label="Retrato"
					value={strFallback(photoNotes.portraitPhoto)}
					onChange={(v) => setField('photoNotes', 'portraitPhoto', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="galleryPhotos"
					label="Fotos de galería"
					value={strFallback(photoNotes.galleryPhotos)}
					onChange={(v) => setField('photoNotes', 'galleryPhotos', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="familyPhoto"
					label="Foto familiar"
					value={strFallback(photoNotes.familyPhoto)}
					onChange={(v) => setField('photoNotes', 'familyPhoto', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="specialPhoto"
					label="Foto especial"
					value={strFallback(photoNotes.specialPhoto)}
					onChange={(v) => setField('photoNotes', 'specialPhoto', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="generalNotes"
					label="Notas generales"
					value={strFallback(photoNotes.generalNotes)}
					onChange={(v) => setField('photoNotes', 'generalNotes', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="photoOrder"
					label="Orden sugerido"
					value={strFallback(photoNotes.photoOrder)}
					onChange={(v) => setField('photoNotes', 'photoOrder', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="cropNotes"
					label="Notas de recorte"
					value={strFallback(photoNotes.cropNotes)}
					onChange={(v) => setField('photoNotes', 'cropNotes', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
				<FormField
					section="photoNotes"
					fieldKey="priorityNotes"
					label="Prioridad"
					value={strFallback(photoNotes.priorityNotes)}
					onChange={(v) => setField('photoNotes', 'priorityNotes', v)}
					type="textarea"
					rows={2}
					errors={validationErrors}
				/>
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
