function resultMessage(hasIssues: boolean, onlyCreated: boolean, allApplied: boolean): string {
	if (hasIssues) {
		return 'Revisa los detalles arriba. Los invitados omitidos, con conflicto o fallidos no se crearon.';
	}
	if (onlyCreated) return 'Los invitados nuevos se crearon correctamente.';
	if (allApplied) return 'Los cambios seleccionados se aplicaron correctamente.';
	return 'No se aplicaron cambios.';
}

function computeSummaryStats(
	created: number,
	updated: number,
	skipped: number | undefined,
	conflicts: number | undefined,
	errors: string[] | undefined,
) {
	const hasErrors = Array.isArray(errors) && errors.length > 0;
	const errorCount = hasErrors ? errors.length : 0;
	const conflictCount = conflicts ?? 0;
	const omitted = skipped ?? 0;
	const failedCount = Math.max(errorCount - conflictCount, 0);
	const hasIssues = failedCount > 0 || omitted > 0 || conflictCount > 0;
	const onlyCreated =
		created > 0 && updated === 0 && omitted === 0 && conflictCount === 0 && failedCount === 0;
	const allApplied =
		created + updated > 0 && omitted === 0 && conflictCount === 0 && failedCount === 0;
	return {
		errorCount,
		conflictCount,
		omitted,
		failedCount,
		hasIssues,
		onlyCreated,
		allApplied,
		hasErrors,
	};
}

interface ImportSummaryProps {
	created: number;
	updated: number;
	skipped?: number;
	conflicts?: number;
	totalAttempted: number;
	errors?: string[];
	onClose: () => void;
	onBack: () => void;
}

function StatItem({
	value,
	labelSingular,
	labelPlural,
	className,
}: {
	value: number;
	labelSingular: string;
	labelPlural: string;
	className: string;
}) {
	return (
		<div className={className}>
			<span className="import-summary__count">{value}</span>
			<span className="import-summary__label">
				{value !== 1 ? labelPlural : labelSingular}
			</span>
		</div>
	);
}

export function ImportSummary({
	created,
	updated,
	skipped,
	conflicts,
	errors,
	onClose,
	onBack,
}: ImportSummaryProps) {
	const { conflictCount, omitted, failedCount, hasIssues, onlyCreated, allApplied, hasErrors } =
		computeSummaryStats(created, updated, skipped, conflicts, errors);

	return (
		<div className="import-summary">
			<h3>Resultado de la importación</h3>
			<div className="import-summary__results">
				{created > 0 && (
					<StatItem
						value={created}
						labelSingular="invitado creado"
						labelPlural="invitados creados"
						className="import-summary__item import-summary__item--success"
					/>
				)}
				{updated > 0 && (
					<StatItem
						value={updated}
						labelSingular="invitado actualizado"
						labelPlural="invitados actualizados"
						className="import-summary__item import-summary__item--info"
					/>
				)}
				{omitted > 0 && (
					<StatItem
						value={omitted}
						labelSingular="omitido"
						labelPlural="omitidos"
						className="import-summary__item import-summary__item--warning"
					/>
				)}
				{conflictCount > 0 && (
					<StatItem
						value={conflictCount}
						labelSingular="conflicto"
						labelPlural="conflictos"
						className="import-summary__item import-summary__item--warning"
					/>
				)}
				{failedCount > 0 && (
					<StatItem
						value={failedCount}
						labelSingular="fallido"
						labelPlural="fallidos"
						className="import-summary__item import-summary__item--error"
					/>
				)}
			</div>

			{hasErrors && (
				<div className="import-summary__errors">
					<h4>Detalles por fila:</h4>
					<ul>
						{errors?.map((err, i) => (
							<li key={i}>{err}</li>
						))}
					</ul>
				</div>
			)}

			<p
				className={
					hasIssues
						? 'dashboard-form-help dashboard-form-help--warning'
						: 'dashboard-form-help import-magic__all-valid'
				}
			>
				{resultMessage(hasIssues, onlyCreated, allApplied)}
			</p>

			<div className="dashboard-modal__actions">
				{hasIssues && (
					<button type="button" className="btn-secondary" onClick={onBack}>
						Volver a la vista previa
					</button>
				)}
				<button type="button" className="btn-primary" onClick={onClose}>
					Cerrar
				</button>
			</div>
		</div>
	);
}
