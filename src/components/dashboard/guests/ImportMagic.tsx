import React, { useState, useRef, useCallback } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import { normalizeImportedPhone } from '@/lib/rsvp/core/utils';
import { DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface ImportMagicProps {
	onImport: (guests: Partial<DashboardGuestItem>[]) => Promise<void>;
	onClose: () => void;
	eventId: string;
}

export interface ParsedGuest {
	fullName: string;
	phone: string;
	phoneCountryCode: string;
	email: string | null;
	error?: string;
	fieldErrors?: {
		fullName?: string;
		phone?: string;
		phoneCountryCode?: string;
		email?: string;
	};
}

export type ColumnTarget = 'fullName' | 'phone' | 'phoneCountryCode' | 'email' | 'ignore';

export interface ColumnAssignment {
	sourceIndex: number;
	sourceName: string;
	target: ColumnTarget;
}

const SPLIT_DELIMITERS = ['\t', ',', ';'];

export function splitLine(line: string): string[] {
	for (const d of SPLIT_DELIMITERS) {
		const split = line.split(d);
		if (split.length > 1) return split;
	}
	return [line];
}

export const KNOWN_HEADERS: Record<string, keyof ParsedGuest> = {
	nombre: 'fullName',
	name: 'fullName',
	full_name: 'fullName',
	teléfono: 'phone',
	telefono: 'phone',
	phone: 'phone',
	clave_pais: 'phoneCountryCode',
	country_code: 'phoneCountryCode',
	correo: 'email',
	email: 'email',
};

export function detectHeaders(firstLine: string): Map<string, keyof ParsedGuest> | null {
	const parts = splitLine(firstLine);
	const headerColumns = parts.map((p) => p.trim().toLowerCase());
	const knownHeaderCount = headerColumns.filter((col) => KNOWN_HEADERS[col]).length;
	if (knownHeaderCount < 2) return null;
	const mapping = new Map<string, keyof ParsedGuest>();
	for (let i = 0; i < headerColumns.length; i++) {
		const target = KNOWN_HEADERS[headerColumns[i]];
		if (target) mapping.set(String(i), target);
	}
	return mapping;
}

function looksLikeDataValue(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith('+')) return true;
	if (/^\d{6,}$/.test(trimmed)) return true;
	if (trimmed.includes('@')) return true;
	return false;
}

export function isHeaderRow(parts: string[]): boolean {
	const lowerParts = parts.map((p) => p.trim().toLowerCase());
	if (lowerParts.some((p) => KNOWN_HEADERS[p])) return true;
	if (parts.every((p) => !looksLikeDataValue(p))) return true;
	return false;
}

export function validateGuestRow(
	guest: ParsedGuest,
): { rowError?: string; fieldErrors?: NonNullable<ParsedGuest['fieldErrors']> } {
	const fieldErrors: NonNullable<ParsedGuest['fieldErrors']> = {};

	const name = guest.fullName.trim();
	const phone = guest.phone.trim();
	const countryCode = guest.phoneCountryCode.trim();

	if (!name) {
		fieldErrors.fullName = 'El nombre es obligatorio.';
	}

	if (!phone && !countryCode) {
		// valid
	} else if (phone && !phone.startsWith('+') && !countryCode) {
		fieldErrors.phone = 'Agrega el código de país o escribe el número completo empezando con +.';
		fieldErrors.phoneCountryCode =
			'La clave país es obligatoria cuando el teléfono no empieza con +.';
	} else if (phone && !phone.startsWith('+') && countryCode) {
		try {
			normalizeImportedPhone(phone, countryCode);
		} catch {
			fieldErrors.phoneCountryCode = 'Código de país no válido.';
		}
	} else if (phone.startsWith('+') && countryCode) {
		try {
			normalizeImportedPhone(phone, countryCode);
		} catch {
			fieldErrors.phone =
				'El teléfono internacional no coincide con el código de país proporcionado.';
			fieldErrors.phoneCountryCode = 'El código de país no coincide con el teléfono.';
		}
	}

	const hasErrors = Object.keys(fieldErrors).length > 0;
	return {
		rowError: hasErrors
			? fieldErrors.phone || fieldErrors.phoneCountryCode || fieldErrors.fullName || 'Corrige los errores de esta fila.'
			: undefined,
		fieldErrors: hasErrors ? fieldErrors : undefined,
	};
}

function applyFieldValue(
	result: ParsedGuest,
	key: keyof ParsedGuest,
	value: string,
): void {
	if (key === 'fullName') result.fullName = value;
	else if (key === 'phone') result.phone = value;
	else if (key === 'phoneCountryCode') result.phoneCountryCode = value;
	else if (key === 'email') result.email = value || null;
}

function parsePositional(parts: string[], result: ParsedGuest): void {
	result.fullName = parts[0]?.trim() ?? '';
	result.phone = parts[1]?.trim() ?? '';

	if (parts.length >= 4) {
		result.phoneCountryCode = parts[2]?.trim() ?? '';
		result.email = parts[3]?.trim() || null;
		return;
	}

	if (parts.length !== 3) {
		result.email = parts[2]?.trim() || null;
		return;
	}

	const third = parts[2]?.trim() ?? '';
	if (third.startsWith('+')) {
		result.phoneCountryCode = third;
		return;
	}
	result.email = third || null;
}

export function parseLine(
	parts: string[],
	columnMapping: Map<string, keyof ParsedGuest> | null,
): ParsedGuest {
	const result: ParsedGuest = {
		fullName: '',
		phone: '',
		phoneCountryCode: '',
		email: null,
	};

	if (columnMapping) {
		for (const [idxStr, field] of columnMapping.entries()) {
			const idx = Number(idxStr);
			const value = parts[idx]?.trim() ?? '';
			applyFieldValue(result, field, value);
		}
	} else {
		parsePositional(parts, result);
	}

	if (result.phoneCountryCode && !result.phoneCountryCode.startsWith('+')) {
		result.phoneCountryCode = '+' + result.phoneCountryCode;
	}

	const validation = validateGuestRow(result);
	result.fieldErrors = validation.fieldErrors;
	result.error = validation.rowError;

	return result;
}

function ImportColumnMapping({
	columnAssignments,
	isNombreMapped,
	onMappingChange,
	onConfirmMapping,
	mappingConfirmDisabled,
}: {
	columnAssignments: ColumnAssignment[];
	isNombreMapped: boolean;
	onMappingChange: (index: number, target: ColumnTarget) => void;
	onConfirmMapping: () => void;
	mappingConfirmDisabled: boolean;
}) {
	const usedTargets = new Set(
		columnAssignments
			.filter((a) => a.target !== 'ignore')
			.map((a) => a.target),
	);
	return (
		<div className="import-magic__column-mapping">
			<p className="import-magic__mapping-message">
				No pudimos identificar todas las columnas. Revisa la asignación antes de continuar.
			</p>
			<p className="dashboard-form-help">
				Asigna las columnas del archivo a los campos esperados.
			</p>
			<div className="import-magic__mapping-grid">
				{columnAssignments.map((col) => (
					<div key={col.sourceIndex} className="import-magic__mapping-row">
						<span className="import-magic__mapping-source">{col.sourceName}</span>
						<select
							value={col.target}
							onChange={(e) => onMappingChange(col.sourceIndex, e.target.value as ColumnTarget)}
							className="import-magic__mapping-select"
						>
							{MAPPING_TARGETS.map((t) => (
								<option key={t} value={t} disabled={t !== 'ignore' && usedTargets.has(t) && col.target !== t}>
									{TARGET_LABELS[t]}
								</option>
							))}
						</select>
					</div>
				))}
			</div>
			{!isNombreMapped && (
				<p className="dashboard-form-help dashboard-form-help--error">
					El nombre es obligatorio para importar invitados.
				</p>
			)}
			<div className="import-magic__mapping-actions">
				<button
					type="button"
					className="btn-primary"
					disabled={mappingConfirmDisabled}
					onClick={onConfirmMapping}
				>
					Confirmar asignación
				</button>
			</div>
		</div>
	);
}

function ImportPreviewTable({
	preview,
	onEdit,
	onDelete,
}: {
	preview: ParsedGuest[];
	onEdit: (index: number, field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email', value: string) => void;
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
									<span className="import-magic__cell-error">{p.fieldErrors.fullName}</span>
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
									<span className="import-magic__cell-error">{p.fieldErrors.phone}</span>
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
									<span className="import-magic__cell-error">{p.fieldErrors.phoneCountryCode}</span>
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
									<span className="import-magic__cell-error">{p.fieldErrors.email}</span>
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
	errorCount,
	previewLength,
}: {
	isFatalError: boolean;
	errorCount: number;
	previewLength: number;
}) {
	if (isFatalError) {
		return (
			<p className="import-magic__fatal-error">{FATAL_ERROR_MESSAGE}</p>
		);
	}
	if (errorCount > 0) {
		return (
			<p className="dashboard-form-help dashboard-form-help--error">
				Corrige los errores antes de importar. Puedes editar los datos directamente en la tabla.
			</p>
		);
	}
	if (errorCount === 0 && previewLength > 0) {
		return (
			<p className="dashboard-form-help import-magic__all-valid">
				Todos los invitados están listos para importarse.
			</p>
		);
	}
	return null;
}

const TARGET_LABELS: Record<ColumnTarget, string> = {
	fullName: 'Nombre',
	phone: 'Teléfono',
	phoneCountryCode: 'Clave país',
	email: 'Correo',
	ignore: 'Ignorar',
};

const MAPPING_TARGETS: ColumnTarget[] = ['fullName', 'phone', 'phoneCountryCode', 'email', 'ignore'];

const FATAL_ERROR_MESSAGE =
	'Los datos son válidos, pero no se puede importar porque el evento no está disponible o no tienes permiso.';

function parseImportContent(
	content: string,
	setters: {
		setImportError: (v: string | null) => void;
		setPreview: (v: ParsedGuest[]) => void;
		setShowColumnMapping: (v: boolean) => void;
		setColumnAssignments: (v: ColumnAssignment[]) => void;
		setRawDataLines: (v: string[][]) => void;
	},
): void {
	const { setImportError, setPreview, setShowColumnMapping, setColumnAssignments, setRawDataLines } = setters;
	setImportError(null);

	const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
	if (lines.length === 0) {
		setPreview([]);
		setShowColumnMapping(false);
		setColumnAssignments([]);
		return;
	}

	const firstParts = splitLine(lines[0]);
	const mapping = detectHeaders(lines[0]);
	const mappingHasFullName = mapping && Array.from(mapping.values()).includes('fullName');

	if (mapping && mappingHasFullName) {
		const dataLines = lines.slice(1);
		const results = dataLines
			.map((line) => parseLine(splitLine(line), mapping))
			.filter((g) => g.fullName);
		setShowColumnMapping(false);
		setPreview(results);
		setColumnAssignments([]);
		setRawDataLines([]);
		return;
	}

	if (isHeaderRow(firstParts)) {
		const assignments: ColumnAssignment[] = firstParts.map((col, i) => {
			const lower = col.trim().toLowerCase();
			const known = KNOWN_HEADERS[lower];
			return {
				sourceIndex: i,
				sourceName: col,
				target: (known as ColumnTarget) ?? 'ignore',
			};
		});
		setRawDataLines(lines.slice(1).map((l) => splitLine(l)));
		setColumnAssignments(assignments);
		setShowColumnMapping(true);
		setPreview([]);
		return;
	}

	const splitLines = lines.map((l) => splitLine(l));
	const assignments: ColumnAssignment[] = splitLines[0].map((_, i) => ({
		sourceIndex: i,
		sourceName: `Columna ${i + 1}`,
		target: 'ignore' as ColumnTarget,
	}));
	setRawDataLines(splitLines);
	setColumnAssignments(assignments);
	setShowColumnMapping(true);
	setPreview([]);
}

const ImportMagic: React.FC<ImportMagicProps> = ({ onImport, onClose, eventId }) => {
	const [text, setText] = useState('');
	const [parsing, setParsing] = useState(false);
	const [preview, setPreview] = useState<ParsedGuest[]>([]);

	const [importError, setImportError] = useState<string | null>(null);
	const [showColumnMapping, setShowColumnMapping] = useState(false);
	const [columnAssignments, setColumnAssignments] = useState<ColumnAssignment[]>([]);
	const [rawDataLines, setRawDataLines] = useState<string[][]>([]);
	const [sourceCollapsed, setSourceCollapsed] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const isNombreMapped = columnAssignments.some((a) => a.target === 'fullName');
	const importLabel = parsing ? 'Procesando...' : 'Importar ' + validCount + ' invitado' + (validCount !== 1 ? 's' : '');
	const isFatalError = isFatalError;
	const importDisabled =
		validCount === 0 ||
		errorCount > 0 ||
		parsing ||
		(showColumnMapping && !isNombreMapped) ||
		isFatalError ||
		!eventId;
	const mappingConfirmDisabled = !isNombreMapped;
	const validCount = preview.filter((g) => !g.error).length;
	const errorCount = preview.filter((g) => g.error).length;
	const isNombreMapped = columnAssignments.some((a) => a.target === 'fullName');
	const isFatalError = importError === FATAL_ERROR_MESSAGE;
	const importLabel = parsing ? 'Procesando...' : `Importar ${validCount} invitado${validCount !== 1 ? 's' : ''}`;
	const importDisabled =
		validCount === 0 || errorCount > 0 || parsing || (showColumnMapping && !isNombreMapped) || isFatalError || !eventId;
	const mappingConfirmDisabled = !isNombreMapped;
const parseContent = (content: string) => {
		parseImportContent(content, {
			setImportError,
			setPreview,
			setShowColumnMapping,
			setColumnAssignments,
			setRawDataLines,
		});
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const content = e.clipboardData.getData('text');
		parseContent(content);
		if (content.trim()) setSourceCollapsed(true);
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			setText(content);
			parseContent(content);
			if (content?.trim()) setSourceCollapsed(true);
		};
		reader.readAsText(file);
	};

	const handleConfirmMapping = () => {
		if (!isNombreMapped) return;
		setImportError(null);

		const mapping = new Map<string, keyof ParsedGuest>();
		for (const a of columnAssignments) {
			if (a.target !== 'ignore') {
				mapping.set(String(a.sourceIndex), a.target as keyof ParsedGuest);
			}
		}

		const results = rawDataLines
			.map((parts) => parseLine(parts, mapping.size > 0 ? mapping : null))
			.filter((g) => g.fullName);

		setShowColumnMapping(false);
		setPreview(results);
	};

	const handleMappingChange = (index: number, target: ColumnTarget) => {
		setImportError(null);
		setColumnAssignments((prev) => {
			const updated = prev.map((a) => ({ ...a }));
			const current = updated[index];
			if (current.target !== 'ignore' && target !== 'ignore') {
				const existing = updated.find(
					(a) => a.sourceIndex !== index && a.target === target,
				);
				if (existing) {
					existing.target = 'ignore';
				}
			}
			updated[index] = { ...current, target };
			return updated;
		});
	};

	const handleEdit = useCallback(
		(index: number, field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email', value: string) => {
			setImportError(null);
			setPreview((prev) => {
				const updated = [...prev];
				const guest = { ...updated[index] };
				if (field === 'email') {
					guest.email = value || null;
				} else if (field === 'phoneCountryCode') {
					const cc = value.trim();
					guest.phoneCountryCode = cc && !cc.startsWith('+') ? '+' + cc : cc;
				} else {
					(guest as Record<string, unknown>)[field] = value;
				}
				delete guest.error;
				delete guest.fieldErrors;
				const validation = validateGuestRow(guest);
				if (validation.rowError) guest.error = validation.rowError;
				if (validation.fieldErrors) guest.fieldErrors = validation.fieldErrors;
				updated[index] = guest;
				return updated;
			});
		},
		[],
	);

	const handleDelete = useCallback((index: number) => {
		setImportError(null);
		setPreview((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleImport = async () => {
		setParsing(true);
		setImportError(null);
		try {
			const valid = preview
				.filter((g) => !g.error)
				.map((g) => ({
					fullName: g.fullName,
					phone: g.phone || undefined,
					phoneCountryCode: g.phoneCountryCode || undefined,
					email: g.email,
					maxAllowedAttendees: 2,
					tags: [] as string[],
				}));
			await onImport(valid);
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : '';
			if (message === 'Event not found or access denied.') {
				setImportError(FATAL_ERROR_MESSAGE);
			} else {
				setImportError('No pudimos importar los invitados. Revisa los datos e inténtalo de nuevo.');
			}
		} finally {
			setParsing(false);
		}
	};

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				role="dialog"
				aria-modal="true"
				onClick={onClose}
			>
				<div
					className="dashboard-modal dashboard-modal--full"
					onClick={(e) => e.stopPropagation()}
				>
					<h3>Importación de invitados</h3>
					<p className="dashboard-modal__description">
						Pega aquí tus invitados desde Excel o Google Sheets, o selecciona un archivo
						CSV.
					</p>
					<p className="dashboard-modal__description">
						Columnas esperadas: <strong>nombre</strong>, <strong>teléfono</strong>,{' '}
						<strong>clave_pais</strong> (ej. +52), <strong>correo</strong>.
						<br />
						Si el teléfono no empieza con +, la columna <strong>clave_pais</strong> es
						obligatoria.
					</p>

					<div className="import-magic__section">
						<textarea
							value={text}
							onPaste={handlePaste}
							onChange={(e) => {
								setText(e.target.value);
								parseContent(e.target.value);
							}}
							placeholder="Ejemplo: Juan Pérez	+52	6691234567"
							rows={sourceCollapsed ? 2 : 4}
							className={`import-magic__textarea ${sourceCollapsed ? 'import-magic__textarea--collapsed' : ''}`}
						/>
						{sourceCollapsed && (
							<button
								type="button"
								className="import-magic__source-toggle"
								onClick={() => setSourceCollapsed(false)}
							>
								Editar datos pegados
							</button>
						)}
					</div>

					<div className="import-magic__section">
						<div className="dashboard-modal__file-actions">
							<input
								type="file"
								accept=".csv"
								ref={fileInputRef}
								className="hidden-input"
								onChange={handleFileChange}
							/>
							<button
								type="button"
								className="btn-secondary"
								onClick={() => fileInputRef.current?.click()}
							>
								Seleccionar CSV
							</button>
						</div>
					</div>

					{showColumnMapping && (
						<ImportColumnMapping
							columnAssignments={columnAssignments}
							isNombreMapped={isNombreMapped}
							onMappingChange={handleMappingChange}
							onConfirmMapping={handleConfirmMapping}
							mappingConfirmDisabled={mappingConfirmDisabled}
						/>
					)}

					{preview.length > 0 && (
						<div className="import-magic__preview">
							<div className="import-magic__summary">
								<span className="import-magic__summary-total">
									Total: {preview.length} invitados
								</span>
								<span className="import-magic__summary-valid">
									Válidos: {validCount}
								</span>
								{errorCount > 0 && (
									<span className="import-magic__summary-error">
										Errores: {errorCount}
									</span>
								)}
							</div>

							<ImportPreviewStatus
								isFatalError={isFatalError}
								errorCount={errorCount}
								previewLength={preview.length}
							/>

							<ImportPreviewTable
								preview={preview}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>

							{errorCount > 0 && (
								<div className="import-magic__error-summary">
									{preview.map(
										(p, i) =>
											p.error && (
												<div key={i} className="import-magic__error-item">
													<strong>Fila {i + 1}</strong> ({p.fullName}):{' '}
													{p.error}
												</div>
											),
									)}
								</div>
							)}
						</div>
					)}

					{preview.length === 0 && !showColumnMapping && text && (
						<div className="import-magic__empty">
							<p>No hay invitados para importar.</p>
						</div>
					)}

					{importError && !isFatalError && (
						<div className="import-magic__api-error">
							{importError}
						</div>
					)}

					<div className="dashboard-modal__actions">
						<button type="button" className="btn-secondary" onClick={onClose}>
							Cancelar
						</button>
						<button
							type="button"
							className="btn-primary"
							disabled={importDisabled}
							onClick={handleImport}
						>
							{importLabel}
						</button>
					</div>
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default ImportMagic;