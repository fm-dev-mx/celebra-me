import type { FC } from 'react';

interface Props {
	data: Record<string, unknown>;
	onChange: (field: string, value: unknown) => void;
	disabled?: boolean;
}

interface FieldConfig {
	key: string;
	label: string;
	type?: 'textarea' | 'checkbox';
	rows?: number;
	placeholder?: string;
}

const FIELDS: FieldConfig[] = [
	{ key: 'whatsappSent', label: 'Ya envié mis fotos por WhatsApp', type: 'checkbox' },
	{
		key: 'heroPhoto',
		label: 'Foto principal / hero',
		type: 'textarea',
		rows: 3,
		placeholder: 'Describe la foto que ira en la portada de la invitacion...',
	},
	{
		key: 'portraitPhoto',
		label: 'Foto retrato',
		type: 'textarea',
		rows: 3,
		placeholder: 'Describe la foto retrato...',
	},
	{
		key: 'galleryPhotos',
		label: 'Fotos de galeria',
		type: 'textarea',
		rows: 4,
		placeholder: 'Describe las fotos para la galeria, orden preferido, etc...',
	},
	{
		key: 'familyPhoto',
		label: 'Foto familiar',
		type: 'textarea',
		rows: 3,
		placeholder: 'Describe la foto familiar...',
	},
	{ key: 'specialPhoto', label: 'Foto especial / seccion especial', type: 'textarea', rows: 3 },
	{
		key: 'generalNotes',
		label: 'Instrucciones generales de fotografia',
		type: 'textarea',
		rows: 3,
		placeholder: 'Cualquier indicacion adicional sobre las fotos...',
	},
	{
		key: 'photoOrder',
		label: 'Orden sugerido de las fotos',
		type: 'textarea',
		rows: 2,
		placeholder: 'Describe el orden en que deben aparecer las fotos...',
	},
	{
		key: 'cropNotes',
		label: 'Notas de recorte y edicion',
		type: 'textarea',
		rows: 2,
		placeholder: 'Indica si alguna foto necesita recorte o edicion especifica...',
	},
	{
		key: 'priorityNotes',
		label: 'Prioridad de las fotos',
		type: 'textarea',
		rows: 2,
		placeholder: 'Indica que fotos son prioritarias o deben destacarse...',
	},
];

const PhotosBlock: FC<Props> = ({ data, onChange, disabled }) => {
	return (
		<div className="intake-block intake-block--photos">
			<h3 className="intake-block__title">Fotografias</h3>

			<div className="intake-block__notice">
				<p>
					Envia tus fotos por WhatsApp como documento (calidad original) cuando sea
					posible. Indica aqui el uso previsto para cada foto o grupo de fotos.
				</p>
			</div>

			{FIELDS.map((field) => {
				if (field.type === 'checkbox') {
					return (
						<div key={field.key} className="intake-field intake-field--checkbox">
							<label className="intake-field__checkbox-label">
								<input
									type="checkbox"
									checked={Boolean(data[field.key])}
									onChange={(e) => onChange(field.key, e.target.checked)}
									disabled={disabled}
								/>
								<span>{field.label}</span>
							</label>
						</div>
					);
				}

				return (
					<div key={field.key} className="intake-field">
						<label className="intake-field__label" htmlFor={field.key}>
							{field.label}
						</label>
						<textarea
							id={field.key}
							className="intake-field__textarea"
							value={(data[field.key] as string) ?? ''}
							onChange={(e) => onChange(field.key, e.target.value)}
							placeholder={field.placeholder}
							disabled={disabled}
							rows={field.rows ?? 3}
						/>
					</div>
				);
			})}
		</div>
	);
};

export default PhotosBlock;
