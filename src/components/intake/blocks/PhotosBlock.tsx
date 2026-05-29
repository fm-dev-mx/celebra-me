import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

const PhotosBlock: FC<Props> = ({ data, onChange, disabled }) => {
	const getValue = (key: string, fallback = '') => (data[key] as string) ?? fallback;
	const getBool = (key: string) => Boolean(data[key]);

	return (
		<div className="intake-block intake-block--photos">
			<h3 className="intake-block__title">Fotografias</h3>

			<div className="intake-block__notice">
				<p>
					Envia tus fotos por WhatsApp como documento (calidad original) cuando sea
					posible. Indica aqui el uso previsto para cada foto o grupo de fotos.
				</p>
			</div>

			<div className="intake-field intake-field--checkbox">
				<label className="intake-field__checkbox-label">
					<input
						type="checkbox"
						checked={getBool('whatsappSent')}
						onChange={(e) => onChange('whatsappSent', e.target.checked)}
						disabled={disabled}
					/>
					<span>Ya envie mis fotos por WhatsApp</span>
				</label>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="heroPhoto">
					Foto principal / hero
				</label>
				<textarea
					id="heroPhoto"
					className="intake-field__textarea"
					value={getValue('heroPhoto')}
					onChange={(e) => onChange('heroPhoto', e.target.value)}
					placeholder="Describe la foto que ira en la portada de la invitacion..."
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="portraitPhoto">
					Foto retrato
				</label>
				<textarea
					id="portraitPhoto"
					className="intake-field__textarea"
					value={getValue('portraitPhoto')}
					onChange={(e) => onChange('portraitPhoto', e.target.value)}
					placeholder="Describe la foto retrato..."
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="galleryPhotos">
					Fotos de galeria
				</label>
				<textarea
					id="galleryPhotos"
					className="intake-field__textarea"
					value={getValue('galleryPhotos')}
					onChange={(e) => onChange('galleryPhotos', e.target.value)}
					placeholder="Describe las fotos para la galeria, orden preferido, etc..."
					disabled={disabled}
					rows={4}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="familyPhoto">
					Foto familiar
				</label>
				<textarea
					id="familyPhoto"
					className="intake-field__textarea"
					value={getValue('familyPhoto')}
					onChange={(e) => onChange('familyPhoto', e.target.value)}
					placeholder="Describe la foto familiar..."
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="specialPhoto">
					Foto especial / seccion especial
				</label>
				<textarea
					id="specialPhoto"
					className="intake-field__textarea"
					value={getValue('specialPhoto')}
					onChange={(e) => onChange('specialPhoto', e.target.value)}
					disabled={disabled}
					rows={3}
				/>
			</div>

			<div className="intake-field">
				<label className="intake-field__label" htmlFor="generalNotes">
					Instrucciones generales de fotografia
				</label>
				<textarea
					id="generalNotes"
					className="intake-field__textarea"
					value={getValue('generalNotes')}
					onChange={(e) => onChange('generalNotes', e.target.value)}
					placeholder="Cualquier indicacion adicional sobre las fotos..."
					disabled={disabled}
					rows={3}
				/>
			</div>
		</div>
	);
};

export default PhotosBlock;
