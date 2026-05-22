interface ImportSummaryProps {
	created: number;
	updated: number;
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
	totalAttempted,
	errors,
	onClose,
	onBack,
}: ImportSummaryProps) {
	const errorCount = errors?.length ?? 0;
	const skipped = totalAttempted - created - updated - errorCount;
	const hasIssues = errorCount > 0 || skipped > 0;

	return (
		<div className="import-summary">
			<h3>Resultado de la importación</h3>
			<div className="import-summary__results">
				<StatItem
					value={created}
					labelSingular="invitado importado"
					labelPlural="invitados importados"
					className="import-summary__item import-summary__item--success"
				/>
				{updated > 0 && (
					<StatItem
						value={updated}
						labelSingular="invitado actualizado"
						labelPlural="invitados actualizados"
						className="import-summary__item import-summary__item--info"
					/>
				)}
				{errorCount > 0 && (
					<StatItem
						value={errorCount}
						labelSingular="error"
						labelPlural="errores"
						className="import-summary__item import-summary__item--error"
					/>
				)}
				{skipped > 0 && (
					<StatItem
						value={skipped}
						labelSingular="omitido"
						labelPlural="omitidos"
						className="import-summary__item import-summary__item--warning"
					/>
				)}
			</div>

			{errorCount > 0 && (
				<div className="import-summary__errors">
					<h4>Errores por fila:</h4>
					<ul>
						{errors!.map((err, i) => (
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
				{hasIssues
					? 'Revisa los errores arriba. Los invitados con errores no se importaron.'
					: 'Todos los invitados se importaron correctamente.'}
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
