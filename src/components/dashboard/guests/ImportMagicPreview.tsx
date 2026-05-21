import React from 'react';
import { pluralS } from '@/components/dashboard/guests/ImportMagic.utils';
import type { ParsedGuest } from '@/components/dashboard/guests/ImportMagic.utils';
import { ImportOmittedList } from '@/components/dashboard/guests/ImportMagicOmitted';
import { DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';

const FATAL_ERROR_MESSAGE =
	'Los datos son válidos, pero no se puede importar porque el evento no está disponible o no tienes permiso.';

function ImportPreviewTable({
	preview,
	onEdit,
	onDelete,
}: {
	preview: ParsedGuest[];
	onEdit: (
		index: number,
		field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email',
		value: string,
	) => void;
	onDelete: (index: number) => void;
}) {
	return (
		<div className="import-magic__table-wrap">
			<table className="import-magic__table">
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Teléfono</th>
						<th>Clave país</th>
						<th>Correo</th>
						<th className="import-magic__th-actions"></th>
					</tr>
				</thead>
				<tbody>
					{preview.map((p, i) => (
						<tr key={i} className={p.error ? 'import-magic__row--error' : ''}>
							<td data-label="Nombre">
								<input
									type="text"
									value={p.fullName}
									onChange={(e) => onEdit(i, 'fullName', e.target.value)}
									className={`import-magic__cell-input ${p.fieldErrors?.fullName ? 'import-magic__cell-input--error' : ''}`}
								/>
								{p.fieldErrors?.fullName && (
									<span className="import-magic__cell-error">
										{p.fieldErrors.fullName}
									</span>
								)}
							</td>
							<td data-label="Teléfono">
								<input
									type="text"
									value={p.phone}
									onChange={(e) => onEdit(i, 'phone', e.target.value)}
									className={`import-magic__cell-input ${p.fieldErrors?.phone ? 'import-magic__cell-input--error' : ''}`}
								/>
								{p.fieldErrors?.phone && (
									<span className="import-magic__cell-error">
										{p.fieldErrors.phone}
									</span>
								)}
							</td>
							<td data-label="Clave país">
								<input
									type="text"
									value={p.phoneCountryCode}
									onChange={(e) => onEdit(i, 'phoneCountryCode', e.target.value)}
									className={`import-magic__cell-input ${p.fieldErrors?.phoneCountryCode ? 'import-magic__cell-input--error' : ''}`}
								/>
								{p.fieldErrors?.phoneCountryCode && (
									<span className="import-magic__cell-error">
										{p.fieldErrors.phoneCountryCode}
									</span>
								)}
							</td>
							<td data-label="Correo">
								<input
									type="text"
									value={p.email ?? ''}
									onChange={(e) => onEdit(i, 'email', e.target.value)}
									className={`import-magic__cell-input ${p.fieldErrors?.email ? 'import-magic__cell-input--error' : ''}`}
								/>
								{p.fieldErrors?.email && (
									<span className="import-magic__cell-error">
										{p.fieldErrors.email}
									</span>
								)}
							</td>
							<td data-label="">
								<button
									type="button"
									className="import-magic__delete-btn btn-icon btn-icon--danger"
									title="Eliminar invitado"
									aria-label={`Eliminar invitado ${i + 1}`}
									onClick={() => onDelete(i)}
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
	newValidCount,
	totalCount,
}: {
	isFatalError: boolean;
	newValidCount: number;
	totalCount: number;
}) {
	if (isFatalError) {
		return <p className="import-magic__fatal-error">{FATAL_ERROR_MESSAGE}</p>;
	}
	if (newValidCount === 0 && totalCount > 0) {
		return (
			<p className="dashboard-form-help dashboard-form-help--warning">
				No hay invitados nuevos para importar.
			</p>
		);
	}
	if (newValidCount > 0 && newValidCount === totalCount) {
		return (
			<p className="dashboard-form-help import-magic__all-valid">
				Todos los invitados están listos para importarse.
			</p>
		);
	}
	if (newValidCount > 0) {
		return (
			<p className="dashboard-form-help">
				Se importarán {newValidCount} invitado{pluralS(newValidCount)} nuevo
				{pluralS(newValidCount)} y válido{pluralS(newValidCount)}.
			</p>
		);
	}
	return null;
}

export function ImportPreviewPanel({
	preview,
	newValidCount,
	existingPhoneCount,
	nameDuplicateCount,
	duplicatePhoneCount,
	errorCount,
	isFatalError,
	visibleRows,
	omittedRecords,
	showColumnMapping,
	text,
	importError,
	handleEdit,
	handleDelete,
}: {
	preview: ParsedGuest[];
	newValidCount: number;
	existingPhoneCount: number;
	nameDuplicateCount: number;
	duplicatePhoneCount: number;
	errorCount: number;
	isFatalError: boolean;
	visibleRows: { guest: ParsedGuest; originalIndex: number }[];
	omittedRecords: ParsedGuest[];
	showColumnMapping: boolean;
	text: string;
	importError: string | null;
	handleEdit: (
		index: number,
		field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email',
		value: string,
	) => void;
	handleDelete: (index: number) => void;
}) {
	if (preview.length === 0 && !showColumnMapping && text) {
		return (
			<div className="import-magic__empty">
				<p>No hay invitados para importar.</p>
			</div>
		);
	}
	if (preview.length === 0) return null;
	return (
		<>
			<div className="import-magic__preview">
				<div className="import-magic__summary">
					<span className="import-magic__summary-total">
						{preview.length} registros leídos
					</span>
					<span className="import-magic__summary-new">
						{newValidCount} invitados nuevos
					</span>
					{existingPhoneCount > 0 && (
						<span className="import-magic__summary-existing">
							{existingPhoneCount} ya estaban agregados por teléfono
						</span>
					)}
					{nameDuplicateCount > 0 && (
						<span className="import-magic__summary-existing">
							{nameDuplicateCount} posibles duplicados por nombre
						</span>
					)}
					{duplicatePhoneCount > 0 && (
						<span className="import-magic__summary-duplicate">
							{duplicatePhoneCount} duplicados en el archivo
						</span>
					)}
					{errorCount > 0 && (
						<span className="import-magic__summary-error">
							{errorCount} con errores
						</span>
					)}
				</div>
				<p className="dashboard-form-help">
					Solo se importarán los invitados nuevos y válidos. Los registros ya agregados,
					duplicados o con errores serán omitidos.
				</p>
				<ImportPreviewStatus
					isFatalError={isFatalError}
					newValidCount={newValidCount}
					totalCount={preview.length}
				/>
				<ImportOmittedList records={omittedRecords} />
				{visibleRows.length > 0 && (
					<ImportPreviewTable
						preview={visibleRows.map((vr) => vr.guest)}
						onEdit={(tableIndex, field, value) =>
							handleEdit(visibleRows[tableIndex].originalIndex, field, value)
						}
						onDelete={(tableIndex) =>
							handleDelete(visibleRows[tableIndex].originalIndex)
						}
					/>
				)}
				{errorCount > 0 && (
					<div className="import-magic__error-summary">
						{preview.map(
							(p, i) =>
								p.error && (
									<div key={i} className="import-magic__error-item">
										<strong>Fila {i + 1}</strong> ({p.fullName}): {p.error}
									</div>
								),
						)}
					</div>
				)}
			</div>
			{importError && !isFatalError && (
				<div className="import-magic__api-error">{importError}</div>
			)}
		</>
	);
}
