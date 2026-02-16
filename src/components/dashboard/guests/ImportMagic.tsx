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
				const phoneE164 = parts[1]?.trim() || '';
				const email = parts[2]?.trim() || null;

				if (fullName) {
					results.push({
						fullName,
						phoneE164,
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
		<div className="import-magic-modal">
			<div className="import-magic-modal__content">
				<h3>Importador Mágico ✨</h3>
				<p>
					Pega aquí tus invitados desde Excel o Google Sheets, o arrastra un archivo CSV.
				</p>

				<textarea
					value={text}
					onPaste={handlePaste}
					onChange={(e) => {
						setText(e.target.value);
						parseContent(e.target.value);
					}}
					placeholder="Ejemplo: Juan Perez	+525512345678"
					rows={8}
				/>

				<div className="import-magic-modal__actions">
					<input
						type="file"
						accept=".csv"
						ref={fileInputRef}
						className="import-magic-modal__file-input"
						onChange={handleFileChange}
					/>
					<button type="button" onClick={() => fileInputRef.current?.click()}>
						Subir CSV
					</button>
				</div>

				{preview.length > 0 && (
					<div className="import-magic-modal__preview">
						<h4>Vista previa ({preview.length} invitados)</h4>
						<table>
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
										<td>{p.fullName}</td>
										<td>
											{p.phoneE164 || (
												<span className="text-warning">Revisar</span>
											)}
										</td>
										<td>{p.email || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
						{preview.length > 10 && <p>...y {preview.length - 10} más</p>}
					</div>
				)}

				<div className="import-magic-modal__footer">
					<button type="button" onClick={onClose}>
						Cancelar
					</button>
					<button
						type="button"
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
