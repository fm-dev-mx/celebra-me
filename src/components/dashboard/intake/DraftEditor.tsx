import type { FC } from 'react';
import { useState, useCallback } from 'react';
import { useInvitationAdmin } from '@/hooks/use-invitation-admin';
import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';

interface Props {
	projectId: string;
	initialContent: DraftContent;
	onCancel: () => void;
}

function str(value: unknown): string {
	if (typeof value === 'string') return value;
	return '';
}

function bool(value: unknown): boolean {
	return typeof value === 'boolean' ? value : false;
}

function num(value: unknown): number {
	return typeof value === 'number' ? value : 0;
}

const DraftEditor: FC<Props> = ({ projectId, initialContent, onCancel }) => {
	const { updateDraft, saving } = useInvitationAdmin();
	const [content, setContent] = useState<DraftContent>(() =>
		JSON.parse(JSON.stringify(initialContent)),
	);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [saved, setSaved] = useState(false);

	const setField = useCallback((section: string, field: string, value: unknown) => {
		setContent((prev) => {
			const sectionData = {
				...(((prev as Record<string, unknown>)[section] as Record<string, unknown>) ?? {}),
			};
			sectionData[field] = value;
			return { ...prev, [section]: sectionData };
		});
	}, []);

	const setTopField = useCallback((field: string, value: unknown) => {
		setContent((prev) => ({ ...prev, [field]: value }));
	}, []);

	const handleSave = async () => {
		setError('');
		setSuccess('');
		try {
			await updateDraft(projectId, content as Record<string, unknown>);
			setSuccess('Borrador guardado exitosamente.');
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al guardar el borrador.');
		}
	};

	const handleCancel = () => {
		if (saved) {
			onCancel();
		} else {
			setContent(JSON.parse(JSON.stringify(initialContent)));
			setError('');
			setSuccess('');
			onCancel();
		}
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

	return (
		<div className="intake-editor">
			{error && <p className="intake-review__error">{error}</p>}
			{success && <p className="intake-review__success">{success}</p>}

			{/* Hero */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Datos principales / Hero</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Titulo</label>
					<input
						className="intake-field__input"
						type="text"
						value={content.title ?? ''}
						onChange={(e) => setTopField('title', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Descripcion</label>
					<textarea
						className="intake-field__textarea"
						value={content.description ?? ''}
						onChange={(e) => setTopField('description', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Nombre del festejado</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(hero.name)}
						onChange={(e) => setField('hero', 'name', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Segundo nombre</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(hero.secondaryName)}
						onChange={(e) => setField('hero', 'secondaryName', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Titulo del evento</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(hero.label)}
						onChange={(e) => setField('hero', 'label', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Apodo</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(hero.nickname)}
						onChange={(e) => setField('hero', 'nickname', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Fecha del evento</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(hero.date)}
						onChange={(e) => setField('hero', 'date', e.target.value)}
					/>
				</div>
			</section>

			{/* Family */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Familia</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Nombre del padre</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(family.fatherName)}
						onChange={(e) => setField('family', 'fatherName', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Padre fallecido</label>
					<input
						type="checkbox"
						className="intake-editor__checkbox"
						checked={bool(family.fatherDeceased)}
						onChange={(e) => setField('family', 'fatherDeceased', e.target.checked)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Nombre de la madre</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(family.motherName)}
						onChange={(e) => setField('family', 'motherName', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Madre fallecida</label>
					<input
						type="checkbox"
						className="intake-editor__checkbox"
						checked={bool(family.motherDeceased)}
						onChange={(e) => setField('family', 'motherDeceased', e.target.checked)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Nombre del conyuge</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(family.spouseName)}
						onChange={(e) => setField('family', 'spouseName', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Padrinos (uno por linea)</label>
					<textarea
						className="intake-field__textarea"
						value={str(family.godparents)}
						onChange={(e) => setField('family', 'godparents', e.target.value)}
						rows={3}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Hijos (uno por linea)</label>
					<textarea
						className="intake-field__textarea"
						value={str(family.children)}
						onChange={(e) => setField('family', 'children', e.target.value)}
						rows={3}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Mensaje familiar</label>
					<textarea
						className="intake-field__textarea"
						value={str(family.sectionMessage)}
						onChange={(e) => setField('family', 'sectionMessage', e.target.value)}
						rows={2}
					/>
				</div>
			</section>

			{/* Location */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Fecha y ubicaciones</h3>
				{['ceremony', 'reception'].map((venueKey) => {
					const venue = content.location?.[venueKey as keyof typeof location] as
						| Record<string, unknown>
						| undefined;
					const label = venueKey === 'ceremony' ? 'Ceremonia' : 'Recepcion';
					return (
						<div key={venueKey} className="intake-editor__venue">
							<h4 className="intake-review__venue-title">{label}</h4>
							<div className="intake-editor__field">
								<label className="intake-field__label">Nombre del lugar</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.venueName)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											venueName: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
							<div className="intake-editor__field">
								<label className="intake-field__label">Direccion</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.address)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											address: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
							<div className="intake-editor__field">
								<label className="intake-field__label">Ciudad</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.city)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											city: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
							<div className="intake-editor__field">
								<label className="intake-field__label">Fecha</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.date)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											date: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
							<div className="intake-editor__field">
								<label className="intake-field__label">Hora</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.time)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											time: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
							<div className="intake-editor__field">
								<label className="intake-field__label">URL del mapa</label>
								<input
									className="intake-field__input"
									type="text"
									value={str(venue?.mapUrl)}
									onChange={(e) => {
										const updated = {
											...(((location as Record<string, unknown>)[
												venueKey
											] as Record<string, unknown>) ?? {}),
											mapUrl: e.target.value,
										};
										setField('location', venueKey, updated);
									}}
								/>
							</div>
						</div>
					);
				})}
				<div className="intake-editor__field">
					<label className="intake-field__label">Codigo de vestimenta</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(location.dressCode)}
						onChange={(e) => setField('location', 'dressCode', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Indicaciones adicionales</label>
					<textarea
						className="intake-field__textarea"
						value={str(location.additionalIndications)}
						onChange={(e) =>
							setField('location', 'additionalIndications', e.target.value)
						}
						rows={2}
					/>
				</div>
			</section>

			{/* RSVP */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Confirmacion de asistencia</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Titulo</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(rsvp.title)}
						onChange={(e) => setField('rsvp', 'title', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Acompanantes maximo</label>
					<input
						className="intake-field__input"
						type="number"
						value={num(rsvp.guestCap)}
						onChange={(e) => setField('rsvp', 'guestCap', Number(e.target.value))}
						min={0}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Mensaje de confirmacion</label>
					<textarea
						className="intake-field__textarea"
						value={str(rsvp.confirmationMessage)}
						onChange={(e) => setField('rsvp', 'confirmationMessage', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Modo de confirmacion</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(rsvp.confirmationMode)}
						onChange={(e) => setField('rsvp', 'confirmationMode', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">WhatsApp</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(rsvp.whatsappPhone)}
						onChange={(e) => setField('rsvp', 'whatsappPhone', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Texto adicional</label>
					<textarea
						className="intake-field__textarea"
						value={str(rsvp.subcopy)}
						onChange={(e) => setField('rsvp', 'subcopy', e.target.value)}
						rows={2}
					/>
				</div>
			</section>

			{/* Music */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Musica de fondo</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">URL de la cancion</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(music.url)}
						onChange={(e) => setField('music', 'url', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Titulo de la cancion</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(music.title)}
						onChange={(e) => setField('music', 'title', e.target.value)}
					/>
				</div>
			</section>

			{/* Gifts */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Regalos</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Titulo</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(gifts.title)}
						onChange={(e) => setField('gifts', 'title', e.target.value)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Subtitulo</label>
					<textarea
						className="intake-field__textarea"
						value={str(gifts.subtitle)}
						onChange={(e) => setField('gifts', 'subtitle', e.target.value)}
						rows={2}
					/>
				</div>
			</section>

			{/* Messages */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Mensajes especiales</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Frase de apertura</label>
					<textarea
						className="intake-field__textarea"
						value={str(quote.text)}
						onChange={(e) => setField('quote', 'text', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Autor</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(quote.author)}
						onChange={(e) => setField('quote', 'author', e.target.value)}
					/>
				</div>
				<h4 className="intake-review__venue-title">Agradecimiento</h4>
				<div className="intake-editor__field">
					<label className="intake-field__label">Mensaje de agradecimiento</label>
					<textarea
						className="intake-field__textarea"
						value={str(thankYou.message)}
						onChange={(e) => setField('thankYou', 'message', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Nombre de despedida</label>
					<input
						className="intake-field__input"
						type="text"
						value={str(thankYou.closingName)}
						onChange={(e) => setField('thankYou', 'closingName', e.target.value)}
					/>
				</div>
			</section>

			{/* Photo notes */}
			<section className="intake-review__section">
				<h3 className="intake-review__section-title">Notas de fotografias</h3>
				<div className="intake-editor__field">
					<label className="intake-field__label">Fotos enviadas por WhatsApp</label>
					<input
						type="checkbox"
						className="intake-editor__checkbox"
						checked={bool(photoNotes.whatsappSent)}
						onChange={(e) => setField('photoNotes', 'whatsappSent', e.target.checked)}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Foto principal</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.heroPhoto)}
						onChange={(e) => setField('photoNotes', 'heroPhoto', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Retrato</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.portraitPhoto)}
						onChange={(e) => setField('photoNotes', 'portraitPhoto', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Fotos de galeria</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.galleryPhotos)}
						onChange={(e) => setField('photoNotes', 'galleryPhotos', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Foto familiar</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.familyPhoto)}
						onChange={(e) => setField('photoNotes', 'familyPhoto', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Foto especial</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.specialPhoto)}
						onChange={(e) => setField('photoNotes', 'specialPhoto', e.target.value)}
						rows={2}
					/>
				</div>
				<div className="intake-editor__field">
					<label className="intake-field__label">Notas generales</label>
					<textarea
						className="intake-field__textarea"
						value={str(photoNotes.generalNotes)}
						onChange={(e) => setField('photoNotes', 'generalNotes', e.target.value)}
						rows={2}
					/>
				</div>
			</section>

			{/* Actions */}
			<div className="intake-review__actions">
				<div className="intake-review__buttons">
					{saved ? (
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
