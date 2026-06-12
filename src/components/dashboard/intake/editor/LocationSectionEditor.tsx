import Field from '@/components/dashboard/intake/editor/Field';
import SectionCard from '@/components/dashboard/intake/editor/SectionCard';
import TextArea from '@/components/dashboard/intake/editor/TextArea';
import ImageAssetField from '@/components/dashboard/intake/editor/ImageAssetField';
import IconPickerField from '@/components/dashboard/intake/editor/IconPickerField';
import { DEFAULT_ICON, isIconName, type IconName } from '@/lib/icons/icon-catalog';
import type { AssetField } from '@/lib/assets/asset-source';
import type { AssetItem } from '@/lib/intake/use-asset-library';
import { MEXICO_TIME_ZONE_OPTIONS } from '@/lib/intake/constants';
import { venueLabel } from '@/lib/intake/utils';
import type { EventTiming } from '@/lib/time/event-time';

interface VenueData {
	venueName?: string;
	address?: string;
	city?: string;
	date?: string;
	time?: string;
	mapUrl?: string;
	image?: AssetField;
}

interface VenueEntryData extends VenueData {
	id: string;
	type: 'ceremony' | 'reception' | 'custom';
	label?: string;
	isVisible: boolean;
}

interface DraftIndication {
	iconName: IconName;
	text: string;
}

interface LocationData {
	introEyebrow?: string;
	introHeading?: string;
	introLede?: string;
	indicationsHeading?: string;
	eventTiming?: EventTiming;
	ceremony?: VenueData;
	reception?: VenueData;
	venues?: VenueEntryData[];
	indications?: DraftIndication[];
}

interface Props {
	location: LocationData;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onUpdateLocation: (patch: Partial<LocationData>) => void;
	onOpenAssetPicker: (field: `location.${string}.image`) => void;
	assetLookupSlug?: string;
	assets?: AssetItem[];
	visible?: boolean;
}

function nextVenueId(): string {
	return `venue_${Date.now()}`;
}

function createDefaultVenue(type: 'ceremony' | 'reception' | 'custom'): VenueEntryData {
	const labels: Record<string, string> = {
		ceremony: 'Ceremonia',
		reception: 'Recepción',
		custom: '',
	};
	return {
		id: nextVenueId(),
		type,
		label: labels[type],
		venueName: '',
		address: '',
		city: '',
		date: '',
		time: '',
		mapUrl: '',
		isVisible: true,
	};
}

export default function LocationSectionEditor({
	location,
	dirty,
	error,
	success,
	sourceBadge,
	onUpdateLocation,
	onOpenAssetPicker,
	assetLookupSlug,
	assets,
	visible = true,
}: Props) {
	const indications = location.indications ?? [];
	const eventTiming = location.eventTiming ?? {};
	const isKnownTimeZone = MEXICO_TIME_ZONE_OPTIONS.some(
		(option) => option.value === eventTiming.timeZone,
	);
	const OTHER_OPTION = '__other__';

	// Use venues if present, otherwise build from legacy ceremony/reception
	const venues: VenueEntryData[] =
		location.venues ??
		(() => {
			const legacy: VenueEntryData[] = [];
			if (location.ceremony) {
				legacy.push({
					id: nextVenueId(),
					type: 'ceremony',
					label: 'Ceremonia',
					...location.ceremony,
					isVisible: true,
				});
			}
			if (location.reception) {
				legacy.push({
					id: nextVenueId(),
					type: 'reception',
					label: 'Recepción',
					...location.reception,
					isVisible: true,
				});
			}
			return legacy;
		})();

	const updateVenue = (index: number, patch: Partial<VenueEntryData>) => {
		const updated = venues.map((v, i) => (i === index ? { ...v, ...patch } : v));
		onUpdateLocation({ venues: updated });
	};

	const removeVenue = (index: number) => {
		const updated = venues.filter((_, i) => i !== index);
		onUpdateLocation({ venues: updated });
	};

	const toggleVenueVisibility = (index: number) => {
		const updated = venues.map((v, i) => (i === index ? { ...v, isVisible: !v.isVisible } : v));
		onUpdateLocation({ venues: updated });
	};

	const addVenue = (type: 'ceremony' | 'reception' | 'custom') => {
		onUpdateLocation({ venues: [...venues, createDefaultVenue(type)] });
	};

	const updateEventTiming = (patch: Partial<EventTiming>) => {
		onUpdateLocation({ eventTiming: { ...eventTiming, ...patch } });
	};

	const updateIndication = (index: number, patch: Partial<DraftIndication>) => {
		const updated = indications.map((item, i) => (i === index ? { ...item, ...patch } : item));
		onUpdateLocation({ indications: updated });
	};

	const removeIndication = (index: number) => {
		onUpdateLocation({ indications: indications.filter((_, i) => i !== index) });
	};

	const addIndication = () => {
		onUpdateLocation({
			indications: [...indications, { iconName: DEFAULT_ICON, text: '' }],
		});
	};

	return (
		<SectionCard
			id="location"
			title="Fecha y ubicaciones"
			description="Ceremonia, recepción e indicaciones."
			dirty={dirty}
			error={error}
			success={success}
			sourceBadge={sourceBadge}
			visible={visible}
		>
			<div className="invitation-editor__section-group">
				<h3>Texto de la sección</h3>
				<div className="invitation-editor__field-grid">
					<Field
						label="Texto superior"
						value={location.introEyebrow ?? ''}
						onChange={(value) => onUpdateLocation({ introEyebrow: value })}
					/>
					<Field
						label="Título de sección"
						value={location.introHeading ?? ''}
						onChange={(value) => onUpdateLocation({ introHeading: value })}
					/>
				</div>
				<TextArea
					label="Descripción de sección"
					value={location.introLede ?? ''}
					onChange={(value) => onUpdateLocation({ introLede: value })}
				/>
			</div>
			<div className="invitation-editor__section-group">
				<h3>Cuenta regresiva</h3>
				<p className="invitation-editor__helper-text">
					Usaremos esta hora local del evento para que la cuenta regresiva termine
					correctamente sin importar desde dónde abran la invitación.
				</p>
				<div className="invitation-editor__field-grid">
					<Field
						label="Hora de inicio para cuenta regresiva"
						type="datetime-local"
						value={eventTiming.localDateTime ?? ''}
						onChange={(value) => updateEventTiming({ localDateTime: value })}
					/>
					<label className="invitation-editor__field">
						<span>Zona horaria del evento</span>
						<select
							value={isKnownTimeZone ? eventTiming.timeZone : OTHER_OPTION}
							onChange={(event) => {
								const val = event.target.value;
								updateEventTiming({ timeZone: val === OTHER_OPTION ? '' : val });
							}}
						>
							<option value="">Selecciona una zona</option>
							{MEXICO_TIME_ZONE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
							<option value={OTHER_OPTION}>Otra zona horaria</option>
						</select>
					</label>
					{!isKnownTimeZone && (
						<Field
							label="Escribe la zona horaria"
							value={eventTiming.timeZone ?? ''}
							placeholder="America/Mazatlan"
							onChange={(value) => updateEventTiming({ timeZone: value })}
						/>
					)}
				</div>
			</div>

			{venues.map((venue, index) => (
				<div className="invitation-editor__subsection" key={venue.id}>
					<div className="invitation-editor__compact-row">
						<h3>{venueLabel(venue.type, venue.label) || 'Ubicación personalizada'}</h3>
						<div className="invitation-editor__reorder">
							<button
								type="button"
								onClick={() => toggleVenueVisibility(index)}
								title={venue.isVisible ? 'Ocultar ubicación' : 'Mostrar ubicación'}
							>
								{venue.isVisible ? 'Ocultar' : 'Mostrar'}
							</button>
							<button type="button" onClick={() => removeVenue(index)}>
								Eliminar
							</button>
						</div>
					</div>
					{venue.type === 'custom' && (
						<Field
							label="Nombre de la ubicación"
							value={venue.label ?? ''}
							onChange={(value) => updateVenue(index, { label: value })}
						/>
					)}
					<div className="invitation-editor__section-group">
						<h4>Datos principales</h4>
						<div className="invitation-editor__field-grid">
							<Field
								label="Lugar"
								value={venue.venueName ?? ''}
								onChange={(value) => updateVenue(index, { venueName: value })}
							/>
							<Field
								label="Dirección"
								value={venue.address ?? ''}
								onChange={(value) => updateVenue(index, { address: value })}
							/>
							<Field
								label="Ciudad"
								value={venue.city ?? ''}
								onChange={(value) => updateVenue(index, { city: value })}
							/>
							<Field
								label="Fecha"
								type="date"
								value={venue.date ?? ''}
								onChange={(value) => updateVenue(index, { date: value })}
							/>
							<Field
								label="Hora"
								type="time"
								value={venue.time ?? ''}
								onChange={(value) => updateVenue(index, { time: value })}
							/>
							<Field
								label="Mapa"
								type="url"
								value={venue.mapUrl ?? ''}
								onChange={(value) => updateVenue(index, { mapUrl: value })}
							/>
						</div>
					</div>
					<div className="invitation-editor__section-group">
						<h4>Imagen del lugar</h4>
						<ImageAssetField
							label="Imagen del lugar"
							value={venue.image}
							assetLookupSlug={assetLookupSlug}
							assets={assets}
							onOpenLibrary={() => onOpenAssetPicker(`location.${venue.id}.image`)}
						/>
					</div>
				</div>
			))}
			<div className="invitation-editor__section-group">
				<h3>Agregar ubicación</h3>
				<div className="invitation-editor__field-grid">
					<button
						className="invitation-editor__secondary-button"
						type="button"
						onClick={() => addVenue('ceremony')}
					>
						+ Ceremonia
					</button>
					<button
						className="invitation-editor__secondary-button"
						type="button"
						onClick={() => addVenue('reception')}
					>
						+ Recepción
					</button>
					<button
						className="invitation-editor__secondary-button"
						type="button"
						onClick={() => addVenue('custom')}
					>
						+ Otra ubicación
					</button>
				</div>
			</div>
			<div className="invitation-editor__section-group">
				<h3>Indicaciones</h3>
				<Field
					label="Título de indicaciones"
					value={location.indicationsHeading ?? ''}
					onChange={(value) => onUpdateLocation({ indicationsHeading: value })}
				/>
				<div className="invitation-editor__stack">
					{indications.map((indication, index) => (
						<article
							className="invitation-editor__list-item"
							key={`${index}-${indication.iconName}`}
						>
							<div className="invitation-editor__compact-row">
								<strong>
									{index + 1}. {indication.text || 'Sin texto'}
								</strong>
								<div className="invitation-editor__reorder">
									<button type="button" onClick={() => removeIndication(index)}>
										Eliminar
									</button>
								</div>
							</div>
							<details className="invitation-editor__row-details">
								<summary>Editar indicación</summary>
								<div className="invitation-editor__field-grid">
									<IconPickerField
										label="Icono"
										value={
											isIconName(indication.iconName)
												? indication.iconName
												: null
										}
										onChange={(iconName) =>
											updateIndication(index, {
												iconName: (iconName ?? DEFAULT_ICON) as IconName,
											})
										}
									/>
									<label className="invitation-editor__field">
										<span>Texto</span>
										<input
											value={indication.text}
											onChange={(event) =>
												updateIndication(index, {
													text: event.target.value,
												})
											}
										/>
									</label>
								</div>
							</details>
						</article>
					))}
				</div>
				<button
					className="invitation-editor__secondary-button"
					type="button"
					onClick={addIndication}
				>
					Agregar indicación
				</button>
			</div>
		</SectionCard>
	);
}
