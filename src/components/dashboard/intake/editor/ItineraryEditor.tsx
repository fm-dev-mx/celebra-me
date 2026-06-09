import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { ICON_CATALOG, DEFAULT_ICON, isIconName } from '@/lib/icons/icon-catalog';
import { moveArrayItem } from '@/lib/intake/utils';
import IconPickerField from '@/components/dashboard/intake/editor/IconPickerField';

type Itinerary = NonNullable<DraftContent['itinerary']>;
type ItineraryItem = Itinerary['items'][number];

interface Props {
	value: Itinerary;
	onChange: (value: Itinerary) => void;
}

const EMPTY_ITEM: ItineraryItem = { iconName: DEFAULT_ICON, label: '', description: '', time: '' };

const ICON_LABEL_MAP = new Map(ICON_CATALOG.map((entry) => [entry.name, entry.label]));

function getIconLabel(name: string): string {
	if (!isIconName(name)) {
		return name;
	}
	return ICON_LABEL_MAP.get(name) ?? name;
}

export default function ItineraryEditor({ value, onChange }: Props) {
	const updateItem = (index: number, patch: Partial<ItineraryItem>) => {
		onChange({
			...value,
			items: value.items.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...patch } : item,
			),
		});
	};

	const move = (index: number, offset: -1 | 1) => {
		onChange({ ...value, items: moveArrayItem(value.items, index, offset) });
	};

	return (
		<div>
			<div className="invitation-editor__field-grid">
				<label className="invitation-editor__field">
					<span>Título del programa</span>
					<input
						value={value.title ?? ''}
						onChange={(event) => onChange({ ...value, title: event.target.value })}
					/>
				</label>
				<label className="invitation-editor__field">
					<span>Subtítulo</span>
					<input
						value={value.subtitle ?? ''}
						onChange={(event) => onChange({ ...value, subtitle: event.target.value })}
					/>
				</label>
			</div>
			<div className="invitation-editor__stack">
				{value.items.map((item, index) => (
					<article className="invitation-editor__list-item" key={index}>
						<div className="invitation-editor__compact-row">
							<strong>
								{index + 1}. {item.label || 'Actividad'} ·{' '}
								{getIconLabel(item.iconName)} · {item.time || 'Sin hora'}
							</strong>
							<div className="invitation-editor__reorder">
								<button
									type="button"
									onClick={() => move(index, -1)}
									disabled={index === 0}
								>
									Subir
								</button>
								<button
									type="button"
									onClick={() => move(index, 1)}
									disabled={index === value.items.length - 1}
								>
									Bajar
								</button>
								<button
									type="button"
									onClick={() =>
										onChange({
											...value,
											items: value.items.filter(
												(_, itemIndex) => itemIndex !== index,
											),
										})
									}
								>
									Eliminar
								</button>
							</div>
						</div>
						<details className="invitation-editor__row-details">
							<summary>Editar actividad</summary>
							<div className="invitation-editor__field-grid">
								<label className="invitation-editor__field">
									<span>Actividad</span>
									<input
										value={item.label}
										onChange={(event) =>
											updateItem(index, { label: event.target.value })
										}
									/>
								</label>
								<label className="invitation-editor__field">
									<span>Hora</span>
									<input
										type="time"
										value={item.time}
										onChange={(event) =>
											updateItem(index, { time: event.target.value })
										}
									/>
								</label>
								<IconPickerField
									label="Icono"
									value={isIconName(item.iconName) ? item.iconName : null}
									onChange={(iconName) =>
										updateItem(index, {
											iconName: iconName ?? DEFAULT_ICON,
										})
									}
								/>
								<label className="invitation-editor__field">
									<span>Descripción</span>
									<input
										value={item.description ?? ''}
										onChange={(event) =>
											updateItem(index, { description: event.target.value })
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
				onClick={() => onChange({ ...value, items: [...value.items, { ...EMPTY_ITEM }] })}
			>
				Agregar actividad
			</button>
		</div>
	);
}
