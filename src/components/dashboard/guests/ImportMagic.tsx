import React, { useState, useRef, useCallback, useMemo } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	pluralS,
	classifyImportedRows,
	reclassifyEditedRow,
	parseCsvLikeContent,
	parseMappedRow,
	validateGuestRow,
	looksLikeDataValue,
	KNOWN_IMPORT_HEADERS,
	IGNORED_EXPORT_HEADERS,
	IMPORT_FATAL_ERROR,
} from '@/components/dashboard/guests/ImportMagic.utils';
import type {
	ParsedGuest,
	ColumnTarget,
	ColumnAssignment,
} from '@/components/dashboard/guests/ImportMagic.utils';
import { ImportPreviewPanel } from '@/components/dashboard/guests/ImportMagicPreview';
import { ImportSummary } from '@/components/dashboard/guests/ImportMagicSummary';
import type { BulkImportResult, UpdateGuestDTO } from '@/lib/dashboard/dto/guests';

interface ImportMagicProps {
	onImport: (guests: Partial<DashboardGuestItem>[]) => Promise<BulkImportResult | void>;
	onUpdate: (guestId: string, payload: UpdateGuestDTO) => Promise<DashboardGuestItem | void>;
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

export function detectHeaders(firstLine: string): Map<string, keyof ParsedGuest> | null {
	const parts = splitLine(firstLine);
	const headerColumns = parts.map((p) => p.trim().toLowerCase());
	const knownHeaderCount = headerColumns.filter((col) => KNOWN_IMPORT_HEADERS[col]).length;
	if (knownHeaderCount < 2) return null;
	const mapping = new Map<string, keyof ParsedGuest>();
	for (let i = 0; i < headerColumns.length; i++) {
		const target = KNOWN_IMPORT_HEADERS[headerColumns[i]];
		if (target) mapping.set(String(i), target);
	}
	return mapping;
}

export function isHeaderRow(parts: string[]): boolean {
	const lowerParts = parts.map((p) => p.trim().toLowerCase());
	if (lowerParts.some((p) => KNOWN_IMPORT_HEADERS[p] || IGNORED_EXPORT_HEADERS.has(p)))
		return true;
	if (parts.every((p) => !looksLikeDataValue(p))) return true;
	return false;
}

export function parseLine(
	parts: string[],
	columnMapping: Map<string, keyof ParsedGuest> | null,
): ParsedGuest {
	const result = parseMappedRow(parts, columnMapping);

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
	maxAllowedAttendees: 'Pases',
	tags: 'Etiquetas',
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

	const parsed = parseCsvLikeContent(content);
	if (parsed.rows.length === 0 && parsed.rawRows.length === 0) {
		setPreview([]);
		setShowColumnMapping(false);
		setColumnAssignments([]);
		return;
	}

	const firstParts = parsed.headers ?? parsed.rawRows[0] ?? [];
	const mapping = parsed.headerMapping;
	const mappingHasFullName = mapping && Array.from(mapping.values()).includes('fullName');

	if (mapping && mappingHasFullName) {
		setShowColumnMapping(false);
		setPreview(parsed.rows);
		setColumnAssignments([]);
		setRawDataLines([]);
		return;
	}

	if (parsed.headers || isHeaderRow(firstParts)) {
		const assignments: ColumnAssignment[] = firstParts.map((col, i) => {
			const lower = col.trim().toLowerCase();
			const known = KNOWN_IMPORT_HEADERS[lower];
			return {
				sourceIndex: i,
				sourceName: col,
				target: (known as ColumnTarget) ?? 'ignore',
			};
		});
		setRawDataLines(parsed.rawRows);
		setColumnAssignments(assignments);
		setShowColumnMapping(true);
		setPreview([]);
		return;
	}

	const assignments: ColumnAssignment[] = parsed.rawRows[0].map((_, i) => ({
		sourceIndex: i,
		sourceName: `Columna ${i + 1}`,
		target: 'ignore' as ColumnTarget,
	}));
	setRawDataLines(parsed.rawRows);
	setColumnAssignments(assignments);
	setShowColumnMapping(true);
	setPreview([]);
}

function toGuestPayload(g: ParsedGuest) {
	return {
		fullName: g.fullName,
		phone: g.normalizedPhone,
		email: g.email,
		maxAllowedAttendees: g.maxAllowedAttendees ?? 2,
		tags: g.tags ?? [],
	};
}

function handleImportError(err: unknown, setError: (msg: string | null) => void) {
	const message = err instanceof Error ? err.message : '';
	if (message === 'Event not found or access denied.') {
		setError(IMPORT_FATAL_ERROR);
		return;
	}
	const details =
		err && typeof err === 'object' && 'details' in err
			? (err as { details: { rows?: string[] } }).details
			: undefined;
	const rowErrors = details?.rows;
	if (Array.isArray(rowErrors) && rowErrors.length > 0) {
		setError('No se pudieron importar algunas filas:\n' + rowErrors.join('\n'));
	} else {
		setError('No pudimos importar los invitados. Revisa los datos e inténtalo de nuevo.');
	}
}

const ImportMagic: React.FC<ImportMagicProps> = ({
	onImport,
	onUpdate,
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
	const [showPossibleDuplicates, setShowPossibleDuplicates] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const frozenExistingGuestsRef = useRef(existingGuests);

	const errorCount = preview.filter((g) => g._status === 'invalid').length;
	const createCount = preview.filter((g) => g.action === 'create' && !g.error).length;
	const updateCount = preview.filter(
		(g) => g.action === 'update' && Boolean(g.matchedGuestId) && !g.error,
	).length;
	const skippedCount = preview.filter((g) => g.action === 'skip' && !g.error).length;
	const reviewCount = preview.filter((g) => g.requiresReview && !g.error).length;
	const hiddenDuplicateCount = preview.filter((g) => g.hiddenByDefault).length;
	const isNombreMapped = columnAssignments.some((a) => a.target === 'fullName');
	const isFatalError = importError === IMPORT_FATAL_ERROR;
	const actionableCount = createCount + updateCount;
	const importLabel = parsing
		? 'Procesando...'
		: actionableCount > 0
			? `Importar ${actionableCount} cambio${pluralS(actionableCount)}`
			: errorCount > 0
				? 'Corregir errores para importar'
				: 'No hay cambios para importar';
	const importDisabled =
		actionableCount === 0 ||
		parsing ||
		(showColumnMapping && !isNombreMapped) ||
		isFatalError ||
		!eventId;
	const mappingConfirmDisabled = !isNombreMapped;

	const visibleRows = useMemo(() => {
		return preview
			.map((guest, index) => ({ guest, originalIndex: index }))
			.filter(({ guest }) => showPossibleDuplicates || !guest.hiddenByDefault);
	}, [preview, showPossibleDuplicates]);

	const handleNewPreview = useCallback((guests: ParsedGuest[]) => {
		setPreview(classifyImportedRows(guests, frozenExistingGuestsRef.current));
	}, []);

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
		setPreview(classifyImportedRows(results, frozenExistingGuestsRef.current));
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
				return reclassifyEditedRow(updated, index, guest, frozenExistingGuestsRef.current);
			});
		},
		[],
	);

	const handleActionChange = useCallback(
		(index: number, action: 'create' | 'update' | 'skip') => {
			setImportError(null);
			setPreview((prev) => {
				const updated = [...prev];
				updated[index] = { ...updated[index], action, actionTouched: true };
				return classifyImportedRows(updated, frozenExistingGuestsRef.current);
			});
		},
		[],
	);

	const handleDelete = useCallback((index: number) => {
		setImportError(null);
		setPreview((prev) => {
			const updated = prev.filter((_, i) => i !== index);
			return classifyImportedRows(updated, frozenExistingGuestsRef.current);
		});
	}, []);

	const handleImport = async () => {
		setParsing(true);
		setImportError(null);
		setImportResult(null);
		try {
			const createRows = preview.filter((g) => g.action === 'create' && !g.error);
			const updateRows = preview.filter(
				(g) => g.action === 'update' && Boolean(g.matchedGuestId) && !g.error,
			);
			if (createRows.length === 0 && updateRows.length === 0) {
				setImportError('No hay cambios para importar.');
				setParsing(false);
				return;
			}
			const skippedRows = preview.filter((g) => g.action === 'skip' || g.error);
			const valid = createRows.map(toGuestPayload);
			const result = valid.length > 0 ? await onImport(valid) : undefined;
			let updatedCount = 0;
			for (const row of updateRows) {
				await onUpdate(row.matchedGuestId!, toGuestPayload(row));
				updatedCount++;
			}
			setImportResult({
				created: result?.created ?? createRows.length,
				updated: (result?.updated ?? 0) + updatedCount,
				skipped: result?.skipped ?? skippedRows.length,
				conflicts: result?.conflicts ?? 0,
				status: result?.status ?? 'success',
				errors: result?.errors,
			});
		} catch (err) {
			handleImportError(err, setImportError);
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
							skipped={importResult.skipped}
							conflicts={importResult.conflicts}
							totalAttempted={preview.length}
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
							createCount={createCount}
							updateCount={updateCount}
							skippedCount={skippedCount}
							reviewCount={reviewCount}
							hiddenDuplicateCount={hiddenDuplicateCount}
							errorCount={errorCount}
							isFatalError={isFatalError}
							visibleRows={visibleRows}
							showColumnMapping={showColumnMapping}
							text={text}
							importError={importError}
							showPossibleDuplicates={showPossibleDuplicates}
							onShowPossibleDuplicatesChange={setShowPossibleDuplicates}
							handleEdit={handleEdit}
							handleActionChange={handleActionChange}
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
