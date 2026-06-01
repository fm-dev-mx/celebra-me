import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { ITINERARY_ICON_KEYS } from '@/lib/theme/theme-contract';

type Itinerary = NonNullable<DraftContent['itinerary']>;
type ItineraryItem = Itinerary['items'][number];

interface Props {
	value: Itinerary;
	onChange: (value: Itinerary) => void;
}

const EMPTY_ITEM: ItineraryItem = { icon: 'sparkles', label: '', description: '', time: '' };

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
		const destination = index + offset;
		if (destination < 0 || destination >= value.items.length) return;
		const items = [...value.items];
		[items[index], items[destination]] = [items[destination], items[index]];
		onChange({ ...value, items });
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
					<article
						className="invitation-editor__list-item"
						key={`${index}-${item.label}`}
					>
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
							<label className="invitation-editor__field">
								<span>Icono</span>
								<select
									value={item.icon}
									onChange={(event) =>
										updateItem(index, {
											icon: event.target.value as ItineraryItem['icon'],
										})
									}
								>
									{ITINERARY_ICON_KEYS.map((icon) => (
										<option key={icon} value={icon}>
											{icon}
										</option>
									))}
								</select>
							</label>
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
