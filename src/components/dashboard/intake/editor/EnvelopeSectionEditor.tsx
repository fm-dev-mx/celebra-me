import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';

interface EnvelopeValue {
	disabled?: boolean;
	envelopeName?: string;
	documentLabel?: string;
	stampText?: string;
	stampYear?: string;
	tooltipText?: string;
	microcopy?: string;
	cardLabel?: string;
	cardName?: string;
	cardSecondaryName?: string;
	cardTagline?: string;
	guestLabel?: string;
	guestNameFallback?: string;
	sealInitials?: string;
}

interface Props {
	value: EnvelopeValue;
	onChange: (patch: EnvelopeValue) => void;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	visible?: boolean;
}

const ENVELOPE_FIELDS = [
	{
		key: 'envelopeName',
		label: 'Nombre en el sobre (opcional)',
		placeholder: 'Si se deja vacío, usa los nombres de Portada',
		maxLength: 200,
	},
	{
		key: 'documentLabel',
		label: 'Etiqueta del documento',
		placeholder: 'Ejemplo: Primera Comunión',
		maxLength: 60,
	},
	{
		key: 'stampText',
		label: 'Texto del sello postal',
		placeholder: 'Ejemplo: Luna y Estrella',
		maxLength: 60,
	},
	{ key: 'stampYear', label: 'Año del sello', placeholder: 'Ejemplo: 2026', maxLength: 10 },
	{
		key: 'tooltipText',
		label: 'Texto del botón',
		placeholder: 'Ejemplo: Abrir invitación',
		maxLength: 100,
	},
	{
		key: 'microcopy',
		label: 'Texto inferior',
		placeholder: 'Ejemplo: Toca para abrir',
		maxLength: 100,
	},
	{
		key: 'cardLabel',
		label: 'Etiqueta de tarjeta',
		placeholder: 'Ejemplo: Primera Comunión',
		maxLength: 60,
	},
	{
		key: 'cardName',
		label: 'Nombre principal en tarjeta (opcional)',
		placeholder: 'Si se deja vacío, usa el nombre principal de Portada',
		maxLength: 200,
	},
	{
		key: 'cardSecondaryName',
		label: 'Segundo nombre en tarjeta (opcional)',
		placeholder: 'Si se deja vacío, usa el segundo nombre de Portada',
		maxLength: 200,
	},
	{
		key: 'cardTagline',
		label: 'Frase secundaria (opcional)',
		placeholder: 'Ejemplo: Una celebración de fe',
		maxLength: 120,
	},
	{
		key: 'guestLabel',
		label: 'Etiqueta de invitado',
		placeholder: 'Ejemplo: Entrega especial para:',
		maxLength: 80,
	},
	{
		key: 'guestNameFallback',
		label: 'Invitado genérico para vista previa',
		placeholder: 'Ejemplo: Familia invitada',
		maxLength: 200,
	},
	{
		key: 'sealInitials',
		label: 'Monograma / iniciales',
		placeholder: 'Ejemplo: A·L',
		maxLength: 12,
	},
] as const;

export default function EnvelopeSectionEditor({
	value: envelope,
	onChange,
	dirty,
	error,
	success,
	sourceBadge,
	visible,
}: Props) {
	return (
		<SectionCard
			id="envelope"
			title="Sobre / apertura"
			description="Controla la experiencia de apertura de la invitación."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<label className="invitation-editor__check">
				<input
					type="checkbox"
					checked={envelope.disabled !== true}
					onChange={(event) => onChange({ disabled: !event.target.checked })}
				/>
				<span>Mostrar sobre de apertura</span>
			</label>
			<div className="invitation-editor__field-grid">
				{ENVELOPE_FIELDS.map(({ key, label, placeholder, maxLength }) => (
					<Field
						key={key}
						label={label}
						value={(envelope[key as keyof EnvelopeValue] ?? '') as string}
						placeholder={placeholder}
						maxLength={maxLength}
						onChange={(value) => onChange({ [key]: value } as EnvelopeValue)}
					/>
				))}
			</div>
		</SectionCard>
	);
}
