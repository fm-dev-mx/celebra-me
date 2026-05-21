import React, { useState } from 'react';
import type { ParsedGuest } from '@/components/dashboard/guests/ImportMagic.utils';

function OmittedSection({
	label,
	count,
	records,
	reasonText,
}: {
	label: string;
	count: number;
	records: ParsedGuest[];
	reasonText: string;
}) {
	const [expanded, setExpanded] = useState(false);
	if (count === 0) return null;
	return (
		<div className="import-magic__omitted-section">
			<button
				type="button"
				className="import-magic__omitted-toggle"
				onClick={() => setExpanded((v) => !v)}
			>
				{expanded ? `Ocultar ${label}` : `Ver ${label} (${count})`}
			</button>
			{expanded && (
				<div className="import-magic__omitted-list">
					{records.map((r, i) => (
						<div key={i} className="import-magic__omitted-item">
							<span className="import-magic__omitted-name">{r.fullName}</span>
							{(r.phone || r.phoneCountryCode) && (
								<span className="import-magic__omitted-phone">
									{r.phoneCountryCode}
									{r.phone ? ` ${r.phone}` : ''}
								</span>
							)}
							<span className="import-magic__omitted-reason">{reasonText}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function ImportOmittedList({ records }: { records: ParsedGuest[] }) {
	const existingPhoneRecords = records.filter((r) => r._status === 'existing-phone');
	const duplicatePhoneRecords = records.filter((r) => r._status === 'duplicate-phone');
	const nameDuplicateRecords = records.filter(
		(r) => r._status === 'existing-name' || r._status === 'duplicate-name',
	);

	if (records.length === 0) return null;

	return (
		<div className="import-magic__omitted">
			<OmittedSection
				label="agregados por teléfono"
				count={existingPhoneRecords.length}
				records={existingPhoneRecords}
				reasonText="Ya agregado"
			/>
			<OmittedSection
				label="duplicados en el archivo"
				count={duplicatePhoneRecords.length}
				records={duplicatePhoneRecords}
				reasonText="Duplicado"
			/>
			<OmittedSection
				label="posibles duplicados por nombre"
				count={nameDuplicateRecords.length}
				records={nameDuplicateRecords}
				reasonText="Posible duplicado"
			/>
		</div>
	);
}
