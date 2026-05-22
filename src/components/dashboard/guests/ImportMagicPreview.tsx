import type {
	ImportRowAction,
	ImportRowStatus,
	ParsedGuest,
} from '@/components/dashboard/guests/ImportMagic.utils';
import { IMPORT_FATAL_ERROR, pluralS } from '@/components/dashboard/guests/ImportMagic.utils';
import { DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';

const STATUS_LABELS: Partial<Record<ImportRowStatus, string>> = {
	invalid: 'Con errores',
	exact_duplicate: 'Duplicado exacto',
	probable_duplicate: 'Posible duplicado',
	same_phone_update: 'Mismo teléfono',
	same_name_different_phone: 'Revisar nombre',
	same_name_missing_phone: 'Revisar teléfono',
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

function ImportPreviewStatus({
	isFatalError,
	actionableCount,
	errorCount,
	totalCount,
}: {
	isFatalError: boolean;
	actionableCount: number;
	errorCount: number;
	totalCount: number;
}) {
	if (isFatalError) return <p className="import-magic__fatal-error">{IMPORT_FATAL_ERROR}</p>;
	if (actionableCount === 0 && errorCount > 0) {
		return (
			<p className="dashboard-form-help dashboard-form-help--error">
				Hay {errorCount} fila{pluralS(errorCount)} con errores. Corrígelas para importar.
			</p>
		);
	}
	if (actionableCount === 0 && totalCount > 0) {
		return (
			<p className="dashboard-form-help dashboard-form-help--warning">
				No hay cambios listos para importar.
			</p>
		);
	}
	if (actionableCount > 0) {
		return (
			<p className="dashboard-form-help">
				Se aplicarán {actionableCount} cambio{pluralS(actionableCount)}.
			</p>
		);
	}
	return null;
}

interface ImportPreviewPanelProps {
	preview: ParsedGuest[];
	createCount: number;
	updateCount: number;
	skippedCount: number;
	reviewCount: number;
	hiddenDuplicateCount: number;
	errorCount: number;
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

export function ImportPreviewPanel({
	preview,
	createCount,
	updateCount,
	skippedCount,
	reviewCount,
	hiddenDuplicateCount,
	errorCount,
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
	if (preview.length === 0 && !showColumnMapping && text) {
		return (
			<div className="import-magic__empty">
				<p>No hay invitados para importar.</p>
			</div>
		);
	}
	if (preview.length === 0) return null;

	const actionableCount = createCount + updateCount;

	return (
		<>
			<div className="import-magic__preview">
				<div className="import-magic__summary">
					<span className="import-magic__summary-total">
						{preview.length} registros leídos
					</span>
					<span className="import-magic__summary-new">Nuevos: {createCount}</span>
					<span className="import-magic__summary-existing">
						Actualizaciones: {updateCount}
					</span>
					<span className="import-magic__summary-duplicate">
						Omitidos: {skippedCount}
					</span>
					<span className="import-magic__summary-error">
						Requieren revisión: {reviewCount}
					</span>
				</div>
				<label className="import-magic__duplicate-toggle">
					<input
						type="checkbox"
						checked={showPossibleDuplicates}
						onChange={(event) => onShowPossibleDuplicatesChange(event.target.checked)}
					/>
					Mostrar posibles duplicados
					{hiddenDuplicateCount > 0 ? ` (${hiddenDuplicateCount})` : ''}
				</label>
				<p className="dashboard-form-help">
					Revisa las coincidencias antes de importar. Los registros omitidos no se
					enviarán.
				</p>
				<ImportPreviewStatus
					isFatalError={isFatalError}
					actionableCount={actionableCount}
					errorCount={errorCount}
					totalCount={preview.length}
				/>
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
