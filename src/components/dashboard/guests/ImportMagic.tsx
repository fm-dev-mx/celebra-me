import React, { useState, useRef, useCallback, useMemo } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import { normalizeImportedPhone, normalizePhone, normalizeName } from '@/lib/rsvp/core/utils';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	pluralS,
	classifyGuests,
	IMPORT_FATAL_ERROR,
} from '@/components/dashboard/guests/ImportMagic.utils';
import type {
	ParsedGuest,
	ColumnTarget,
	ColumnAssignment,
} from '@/components/dashboard/guests/ImportMagic.utils';
import { ImportPreviewPanel } from '@/components/dashboard/guests/ImportMagicPreview';
import { ImportSummary } from '@/components/dashboard/guests/ImportMagicSummary';
import type { BulkImportResult } from '@/lib/dashboard/dto/guests';

interface ImportMagicProps {
	onImport: (guests: Partial<DashboardGuestItem>[]) => Promise<BulkImportResult>;
	onClose: () => void;
	eventId: string;
	existingGuests: DashboardGuestItem[];
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

export function validateGuestRow(guest: ParsedGuest): {
	rowError?: string;
	fieldErrors?: NonNullable<ParsedGuest['fieldErrors']>;
} {
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
		fieldErrors.phone =
			'Agrega el código de país o escribe el número completo empezando con +.';
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
			? fieldErrors.phone ||
				fieldErrors.phoneCountryCode ||
				fieldErrors.fullName ||
				'Corrige los errores de esta fila.'
			: undefined,
		fieldErrors: hasErrors ? fieldErrors : undefined,
	};
}

function applyFieldValue(result: ParsedGuest, key: keyof ParsedGuest, value: string): void {
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
		columnAssignments.filter((a) => a.target !== 'ignore').map((a) => a.target),
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
							onChange={(e) =>
								onMappingChange(col.sourceIndex, e.target.value as ColumnTarget)
							}
							className="import-magic__mapping-select"
						>
							{MAPPING_TARGETS.map((t) => (
								<option
									key={t}
									value={t}
									disabled={
										t !== 'ignore' && usedTargets.has(t) && col.target !== t
									}
								>
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

const TARGET_LABELS: Record<ColumnTarget, string> = {
	fullName: 'Nombre',
	phone: 'Teléfono',
	phoneCountryCode: 'Clave país',
	email: 'Correo',
	ignore: 'Ignorar',
};

const MAPPING_TARGETS: ColumnTarget[] = [
	'fullName',
	'phone',
	'phoneCountryCode',
	'email',
	'ignore',
];

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
	const {
		setImportError,
		setPreview,
		setShowColumnMapping,
		setColumnAssignments,
		setRawDataLines,
	} = setters;
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

const ImportMagic: React.FC<ImportMagicProps> = ({
	onImport,
	onClose,
	eventId,
	existingGuests,
}) => {
	const [text, setText] = useState('');
	const [parsing, setParsing] = useState(false);
	const [preview, setPreview] = useState<ParsedGuest[]>([]);

	const [importError, setImportError] = useState<string | null>(null);
	const [showColumnMapping, setShowColumnMapping] = useState(false);
	const [columnAssignments, setColumnAssignments] = useState<ColumnAssignment[]>([]);
	const [rawDataLines, setRawDataLines] = useState<string[][]>([]);
	const [sourceCollapsed, setSourceCollapsed] = useState(false);
	const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const existingPhones = useMemo(
		() => new Set(existingGuests.filter((g) => g.phone).map((g) => normalizePhone(g.phone))),
		[existingGuests],
	);

	const existingNames = useMemo(
		() => new Set(existingGuests.map((g) => normalizeName(g.fullName)).filter(Boolean)),
		[existingGuests],
	);

	const errorCount = preview.filter((g) => g.error).length;
	const newValidCount = preview.filter((g) => g._status === 'new' && !g.error).length;
	const existingPhoneCount = preview.filter((g) => g._status === 'existing-phone').length;
	const duplicatePhoneCount = preview.filter((g) => g._status === 'duplicate-phone').length;
	const nameDuplicateCount = preview.filter(
		(g) => g._status === 'existing-name' || g._status === 'duplicate-name',
	).length;
	const isNombreMapped = columnAssignments.some((a) => a.target === 'fullName');
	const isFatalError = importError === IMPORT_FATAL_ERROR;
	const importLabel = parsing
		? 'Procesando...'
		: newValidCount > 0
			? `Importar ${newValidCount} invitado${pluralS(newValidCount)} nuevo${pluralS(newValidCount)}`
			: errorCount > 0
				? 'Corregir errores para importar'
				: 'No hay invitados nuevos para importar';
	const importDisabled =
		newValidCount === 0 ||
		parsing ||
		(showColumnMapping && !isNombreMapped) ||
		isFatalError ||
		!eventId;
	const mappingConfirmDisabled = !isNombreMapped;

	const visibleRows = useMemo(() => {
		return preview
			.map((guest, index) => ({ guest, originalIndex: index }))
			.filter(({ guest }) => guest._status === 'new');
	}, [preview]);

	const omittedRecords = useMemo(
		() =>
			preview.filter(
				(g) =>
					g._status === 'existing-phone' ||
					g._status === 'duplicate-phone' ||
					g._status === 'existing-name' ||
					g._status === 'duplicate-name',
			),
		[preview],
	);
	const handleNewPreview = useCallback(
		(guests: ParsedGuest[]) => {
			setPreview(classifyGuests(guests, existingPhones, existingNames));
		},
		[existingPhones, existingNames],
	);

	const parseContent = (content: string) => {
		parseImportContent(content, {
			setImportError,
			setPreview: handleNewPreview,
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
		setPreview(classifyGuests(results, existingPhones, existingNames));
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
		(
			index: number,
			field: 'fullName' | 'phone' | 'phoneCountryCode' | 'email',
			value: string,
		) => {
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
				return classifyGuests(updated, existingPhones, existingNames);
			});
		},
		[existingPhones, existingNames],
	);

	const handleDelete = useCallback(
		(index: number) => {
			setImportError(null);
			setPreview((prev) => {
				const updated = prev.filter((_, i) => i !== index);
				return classifyGuests(updated, existingPhones, existingNames);
			});
		},
		[existingPhones, existingNames],
	);

	const handleImport = async () => {
		setParsing(true);
		setImportError(null);
		setImportResult(null);
		try {
			const newGuests = preview.filter((g) => g._status === 'new' && !g.error);
			if (newGuests.length === 0) {
				setImportError('No hay invitados nuevos para importar.');
				setParsing(false);
				return;
			}
			const valid = newGuests.map((g) => ({
				fullName: g.fullName,
				phone: g.normalizedPhone,
				email: g.email,
				maxAllowedAttendees: 2,
				tags: [] as string[],
			}));
			const result = await onImport(valid);
			setImportResult(result);
		} catch (err) {
			const message = err instanceof Error ? err.message : '';
			if (message === 'Event not found or access denied.') {
				setImportError(IMPORT_FATAL_ERROR);
			} else {
				const details =
					err && typeof err === 'object' && 'details' in err
						? (err as { details: { rows?: string[] } }).details
						: undefined;
				const rowErrors = details?.rows;
				if (Array.isArray(rowErrors) && rowErrors.length > 0) {
					setImportError(
						'No se pudieron importar algunas filas:\n' + rowErrors.join('\n'),
					);
				} else {
					setImportError(
						'No pudimos importar los invitados. Revisa los datos e inténtalo de nuevo.',
					);
				}
			}
		} finally {
			setParsing(false);
		}
	};

	if (importResult) {
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
						<ImportSummary
							created={importResult.created}
							updated={importResult.updated}
							totalAttempted={newValidCount}
							errors={importResult.errors}
							onClose={onClose}
							onBack={() => setImportResult(null)}
						/>
					</div>
				</div>
			</DashboardModalPortal>
		);
	}

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
					<div className="dashboard-modal__content">
						<p className="dashboard-modal__description">
							Pega aquí tus invitados desde Excel o Google Sheets, o selecciona un
							archivo CSV.
						</p>
						<p className="dashboard-modal__description">
							Columnas esperadas: <strong>nombre</strong>, <strong>teléfono</strong>,{' '}
							<strong>clave_pais</strong> (ej. +52), <strong>correo</strong>.
							<br />
							Si el teléfono no empieza con +, la columna <strong>
								clave_pais
							</strong>{' '}
							es obligatoria.
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

						<ImportPreviewPanel
							preview={preview}
							newValidCount={newValidCount}
							existingPhoneCount={existingPhoneCount}
							nameDuplicateCount={nameDuplicateCount}
							duplicatePhoneCount={duplicatePhoneCount}
							errorCount={errorCount}
							isFatalError={isFatalError}
							visibleRows={visibleRows}
							omittedRecords={omittedRecords}
							showColumnMapping={showColumnMapping}
							text={text}
							importError={importError}
							handleEdit={handleEdit}
							handleDelete={handleDelete}
						/>
					</div>

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
