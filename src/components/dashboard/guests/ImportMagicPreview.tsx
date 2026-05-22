import type {
	ImportRowAction,
	ImportRowStatus,
	ParsedGuest,
	DisplayCategories,
} from '@/components/dashboard/guests/ImportMagic.utils';
import { IMPORT_FATAL_ERROR } from '@/components/dashboard/guests/ImportMagic.utils';
import { DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';

const STATUS_LABELS: Partial<Record<ImportRowStatus, string>> = {
	invalid: 'Con errores',
	exact_duplicate: 'Duplicado exacto',
	probable_duplicate: 'Duplicado probable',
	possible_duplicate: 'Posible duplicado',
	phone_conflict: 'Conflicto de teléfono',
	ambiguous_name_match: 'Nombre ambiguo',
	internal_duplicate: 'Duplicado en archivo',
};

function statusLabel(guest: ParsedGuest): string {
	if (guest._status && STATUS_LABELS[guest._status]) return STATUS_LABELS[guest._status]!;
	return 'Nuevo';
}

function badgeClass(guest: ParsedGuest): string {
	if (guest.error || guest._status === 'invalid') return 'import-magic__badge--error';
	if (guest.requiresReview) return 'import-magic__badge--warning';
	if (guest.action === 'update') return 'import-magic__badge--info';
	return 'import-magic__badge--new';
}

function canUpdate(guest: ParsedGuest): boolean {
	return Boolean(guest.matchedGuestId) && guest._status !== 'ambiguous_name_match';
}

function ImportPreviewTable({
	rows,
	onEdit,
	onActionChange,
	onDelete,
}: {
	rows: { guest: ParsedGuest; originalIndex: number }[];
	onEdit: (
		index: number,
		field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email',
		value: string,
	) => void;
	onActionChange: (index: number, action: ImportRowAction) => void;
	onDelete: (index: number) => void;
}) {
	return (
		<div className="import-magic__table-wrap">
			<table className="import-magic__table">
				<thead>
					<tr>
						<th>Estado</th>
						<th>Acción</th>
						<th>Nombre</th>
						<th>Teléfono</th>
						<th>Clave país</th>
						<th>Correo</th>
						<th className="import-magic__th-actions"></th>
					</tr>
				</thead>
				<tbody>
					{rows.map(({ guest, originalIndex }, tableIndex) => (
						<tr
							key={`${originalIndex}-${tableIndex}`}
							className={guest.error ? 'import-magic__row--error' : ''}
						>
							<td data-label="Estado">
								<span className={`import-magic__badge ${badgeClass(guest)}`}>
									{statusLabel(guest)}
								</span>
								{guest.matchedGuestName && (
									<span className="import-magic__cell-note">
										Coincide con {guest.matchedGuestName}
									</span>
								)}
							</td>
							<td data-label="Acción">
								<select
									value={guest.action ?? 'skip'}
									onChange={(event) =>
										onActionChange(
											originalIndex,
											event.target.value as ImportRowAction,
										)
									}
									className="import-magic__action-select"
								>
									<option value="create">Crear nuevo</option>
									<option value="update" disabled={!canUpdate(guest)}>
										Actualizar existente
									</option>
									<option value="skip">Omitir</option>
								</select>
							</td>
							<td data-label="Nombre">
								<input
									type="text"
									value={guest.fullName}
									onChange={(event) =>
										onEdit(originalIndex, 'fullName', event.target.value)
									}
									className={`import-magic__cell-input ${guest.fieldErrors?.fullName ? 'import-magic__cell-input--error' : ''}`}
								/>
								{guest.fieldErrors?.fullName && (
									<span className="import-magic__cell-error">
										{guest.fieldErrors.fullName}
									</span>
								)}
							</td>
							<td data-label="Teléfono">
								<input
									type="text"
									value={guest.phone}
									onChange={(event) =>
										onEdit(originalIndex, 'phone', event.target.value)
									}
									className={`import-magic__cell-input ${guest.fieldErrors?.phone ? 'import-magic__cell-input--error' : ''}`}
								/>
								{guest.fieldErrors?.phone && (
									<span className="import-magic__cell-error">
										{guest.fieldErrors.phone}
									</span>
								)}
							</td>
							<td data-label="Clave país">
								<input
									type="text"
									value={guest.phoneCountryCode}
									onChange={(event) =>
										onEdit(
											originalIndex,
											'phoneCountryCode',
											event.target.value,
										)
									}
									className={`import-magic__cell-input ${guest.fieldErrors?.phoneCountryCode ? 'import-magic__cell-input--error' : ''}`}
								/>
								{guest.fieldErrors?.phoneCountryCode && (
									<span className="import-magic__cell-error">
										{guest.fieldErrors.phoneCountryCode}
									</span>
								)}
							</td>
							<td data-label="Correo">
								<input
									type="text"
									value={guest.email ?? ''}
									onChange={(event) =>
										onEdit(originalIndex, 'email', event.target.value)
									}
									className={`import-magic__cell-input ${guest.fieldErrors?.email ? 'import-magic__cell-input--error' : ''}`}
								/>
							</td>
							<td data-label="">
								<button
									type="button"
									className="import-magic__delete-btn btn-icon btn-icon--danger"
									title="Eliminar invitado"
									aria-label={`Eliminar invitado ${originalIndex + 1}`}
									onClick={() => onDelete(originalIndex)}
								>
									<DeleteGlyph size={14} />
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

interface ImportPreviewPanelProps {
	preview: ParsedGuest[];
	display: DisplayCategories;
	isFatalError: boolean;
	visibleRows: { guest: ParsedGuest; originalIndex: number }[];
	showColumnMapping: boolean;
	text: string;
	importError: string | null;
	showPossibleDuplicates: boolean;
	onShowPossibleDuplicatesChange: (value: boolean) => void;
	handleEdit: (
		index: number,
		field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email',
		value: string,
	) => void;
	handleActionChange: (index: number, action: ImportRowAction) => void;
	handleDelete: (index: number) => void;
}

function SummaryChip({
	value,
	label,
	className,
}: {
	value: number;
	label: string;
	className: string;
}) {
	return (
		<span className={`import-magic__summary-chip ${className}`}>
			<span className="import-magic__chip-value">{value}</span>
			<span className="import-magic__chip-label">{label}</span>
		</span>
	);
}

export function ImportPreviewPanel({
	preview,
	display,
	isFatalError,
	visibleRows,
	showColumnMapping,
	text,
	importError,
	showPossibleDuplicates,
	onShowPossibleDuplicatesChange,
	handleEdit,
	handleActionChange,
	handleDelete,
}: ImportPreviewPanelProps) {
	if (preview.length === 0) {
		if (text && !showColumnMapping) {
			return (
				<div className="import-magic__empty">
					<p>No hay invitados para importar.</p>
				</div>
			);
		}
		return null;
	}

	return (
		<>
			<div className="import-magic__preview">
				<div className="import-magic__summary-chips">
					{display.create > 0 && (
						<SummaryChip
							value={display.create}
							label="Crear"
							className="import-magic__summary-chip--create"
						/>
					)}
					{display.update > 0 && (
						<SummaryChip
							value={display.update}
							label="Actualizar"
							className="import-magic__summary-chip--update"
						/>
					)}
					{display.review > 0 && (
						<SummaryChip
							value={display.review}
							label="Revisar"
							className="import-magic__summary-chip--review"
						/>
					)}
					{display.omitted > 0 && (
						<SummaryChip
							value={display.omitted}
							label="Sin cambios"
							className="import-magic__summary-chip--omitted"
						/>
					)}
					{display.error > 0 && (
						<SummaryChip
							value={display.error}
							label="Errores"
							className="import-magic__summary-chip--error"
						/>
					)}
				</div>

				{display.hiddenReview > 0 && !showPossibleDuplicates && (
					<p className="import-magic__hidden-hint">
						{display.hiddenReview} posible{display.hiddenReview !== 1 ? 's' : ''}{' '}
						duplicado
						{display.hiddenReview !== 1 ? 's' : ''} oculto
						{display.hiddenReview !== 1 ? 's' : ''}
					</p>
				)}

				<label className="import-magic__duplicate-toggle">
					<input
						type="checkbox"
						checked={showPossibleDuplicates}
						onChange={(event) => onShowPossibleDuplicatesChange(event.target.checked)}
					/>
					Mostrar posibles duplicados
				</label>

				{isFatalError && <p className="import-magic__fatal-error">{IMPORT_FATAL_ERROR}</p>}

				{visibleRows.length > 0 && (
					<ImportPreviewTable
						rows={visibleRows}
						onEdit={handleEdit}
						onActionChange={handleActionChange}
						onDelete={handleDelete}
					/>
				)}
			</div>
			{importError && !isFatalError && (
				<div className="import-magic__api-error">{importError}</div>
			)}
		</>
	);
}
