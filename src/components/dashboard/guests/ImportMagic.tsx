import React, { useState, useRef } from 'react';
import type { DashboardGuestItem } from './types';

interface ImportMagicProps {
	onImport: (guests: Partial<DashboardGuestItem>[]) => Promise<void>;
	onClose: () => void;
}

const ImportMagic: React.FC<ImportMagicProps> = ({ onImport, onClose }) => {
	const [text, setText] = useState('');
	const [parsing, setParsing] = useState(false);
	const [preview, setPreview] = useState<Partial<DashboardGuestItem>[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const parseContent = (content: string) => {
		const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
		const results: Partial<DashboardGuestItem>[] = [];

		lines.forEach((line) => {
			// Soporte para tabulación (Excel/Sheets) o comas (CSV)
			const delimiters = ['\t', ',', ';'];
			let parts: string[] = [line];

			for (const d of delimiters) {
				const split = line.split(d);
				if (split.length > 1) {
					parts = split;
					break;
				}
			}

			if (parts.length >= 1) {
				const fullName = parts[0]?.trim();
				const phone = parts[1]?.trim() || '';
				const email = parts[2]?.trim() || null;

				if (fullName) {
					results.push({
						fullName,
						phone,
						email,
						maxAllowedAttendees: 2, // Default
						tags: [],
					});
				}
			}
		});

		setPreview(results);
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const content = e.clipboardData.getData('text');
		parseContent(content);
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			setText(content);
			parseContent(content);
		};
		reader.readAsText(file);
	};

	return (
		<div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
			<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
				<h3>Importador Mágico ✨</h3>
				<p className="dashboard-modal__description">
					Pega aquí tus invitados desde Excel o Google Sheets, o arrastra un archivo CSV.
				</p>

				<textarea
					value={text}
					onPaste={handlePaste}
					onChange={(e) => {
						setText(e.target.value);
						parseContent(e.target.value);
					}}
					placeholder="Ejemplo: Juan Perez  6671234567"
					rows={8}
					className="dashboard-form-field__textarea dashboard-form-field__textarea--import"
				/>

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
						Subir CSV
					</button>
				</div>

				{preview.length > 0 && (
					<div className="import-magic-modal__preview">
						<h4>Vista previa ({preview.length} invitados)</h4>
						<table className="dashboard-guests__table">
							<thead>
								<tr>
									<th>Nombre</th>
									<th>Teléfono</th>
									<th>Email</th>
								</tr>
							</thead>
							<tbody>
								{preview.slice(0, 10).map((p, i) => (
									<tr key={i}>
										<td data-label="Nombre">{p.fullName}</td>
										<td data-label="Teléfono">
											{p.phone || (
												<span className="text-warning">Revisar</span>
											)}
										</td>
										<td data-label="Email">{p.email || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
						{preview.length > 10 && (
							<p className="dashboard-form-help">...y {preview.length - 10} más</p>
						)}
					</div>
				)}

				<div className="dashboard-modal__actions">
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cancelar
					</button>
					<button
						type="button"
						className="btn-primary"
						disabled={preview.length === 0 || parsing}
						onClick={async () => {
							setParsing(true);
							await onImport(preview);
							setParsing(false);
							onClose();
						}}
					>
						{parsing ? 'Procesando...' : 'Importar Todo'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ImportMagic;
