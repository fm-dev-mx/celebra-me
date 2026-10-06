import type { MemoriesMediaKind, MemoriesOrganizerUploader } from '@/lib/memories/contract/catalog';

export type MemoriesOrganizerFilters = {
	kind: '' | MemoriesMediaKind;
	/** Only the files the host hid; the default view shows every file. */
	hiddenOnly: boolean;
	uploaderAlias: string;
	createdOn: string;
};

export const EMPTY_MEMORIES_FILTERS: MemoriesOrganizerFilters = {
	kind: '',
	hiddenOnly: false,
	uploaderAlias: '',
	createdOn: '',
};

export function hasMemoriesFilters(filters: MemoriesOrganizerFilters): boolean {
	return Boolean(
		filters.kind || filters.hiddenOnly || filters.uploaderAlias || filters.createdOn,
	);
}

interface Props {
	applied: MemoriesOrganizerFilters;
	uploaders: MemoriesOrganizerUploader[];
	disabled: boolean;
	onApply: (filters: MemoriesOrganizerFilters) => void;
}

const KIND_CHIPS: Array<{ value: MemoriesOrganizerFilters['kind']; label: string }> = [
	{ value: '', label: 'Todo' },
	{ value: 'photo', label: 'Fotos' },
	{ value: 'video', label: 'Videos' },
];

/** Every control applies as soon as it changes; there is no «Aplicar» step. */
export default function MemoriesFilters({ applied, uploaders, disabled, onApply }: Props) {
	return (
		<div className="memories-filters" role="search" aria-label="Filtrar recuerdos">
			<div className="memories-filters__chips" role="group" aria-label="Tipo">
				{KIND_CHIPS.map((chip) => (
					<button
						key={chip.label}
						type="button"
						className="memories-chip"
						aria-pressed={!applied.hiddenOnly && applied.kind === chip.value}
						disabled={disabled}
						onClick={() => onApply({ ...applied, kind: chip.value, hiddenOnly: false })}
					>
						{chip.label}
					</button>
				))}
				<button
					type="button"
					className="memories-chip"
					aria-pressed={applied.hiddenOnly}
					disabled={disabled}
					onClick={() => onApply({ ...applied, hiddenOnly: !applied.hiddenOnly })}
				>
					Ocultas
				</button>
			</div>
			<label className="memories-filters__field">
				<span>Invitado</span>
				<select
					value={applied.uploaderAlias}
					disabled={disabled}
					onChange={(event) => onApply({ ...applied, uploaderAlias: event.target.value })}
				>
					<option value="">Todos los invitados</option>
					{uploaders.map((uploader) => (
						<option key={uploader.guestAlias} value={uploader.guestAlias}>
							{uploader.displayName} ({uploader.files})
						</option>
					))}
				</select>
			</label>
			<label className="memories-filters__field">
				<span>Día de subida</span>
				<input
					type="date"
					value={applied.createdOn}
					disabled={disabled}
					onChange={(event) => onApply({ ...applied, createdOn: event.target.value })}
				/>
			</label>
			{hasMemoriesFilters(applied) ? (
				<button
					type="button"
					className="btn-secondary memories-filters__clear"
					disabled={disabled}
					onClick={() => onApply(EMPTY_MEMORIES_FILTERS)}
				>
					Limpiar filtros
				</button>
			) : null}
		</div>
	);
}
