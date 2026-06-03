import type { ReactNode } from 'react';

interface Props {
	id: string;
	title: string;
	description: string;
	children: ReactNode;
	dirty: boolean;
	error?: string;
	success?: string;
	sourceBadge?: { source: string; label: string };
	onSave?: () => void;
	saving?: boolean;
}

export default function SectionCard({
	id,
	title,
	description,
	children,
	dirty,
	error,
	success,
	sourceBadge,
	onSave,
	saving,
}: Props) {
	const headingId = `section-${id}-heading`;
	return (
		<section
			className={`invitation-editor__card${dirty ? ' invitation-editor__card--dirty' : ''}${error ? ' invitation-editor__card--error' : ''}`}
			id={id}
			aria-labelledby={headingId}
		>
			<div className="invitation-editor__card-header">
				<div className="invitation-editor__card-title">
					<h2 id={headingId}>{title}</h2>
					<p>{description}</p>
				</div>
				<div className="invitation-editor__card-header-badges">
					{sourceBadge && (
						<span
							className={`invitation-editor__source-badge invitation-editor__source-badge--${sourceBadge.source}`}
						>
							{sourceBadge.label}
						</span>
					)}
					{dirty && <span className="invitation-editor__dirty">Cambios sin guardar</span>}
				</div>
			</div>
			<div className="invitation-editor__card-body">{children}</div>
			<div className="invitation-editor__card-footer" aria-live="polite">
				<div>
					{error && <p className="invitation-editor__error">{error}</p>}
					{success && <p className="invitation-editor__success">{success}</p>}
				</div>
				{onSave && dirty && (
					<button
						type="button"
						className="invitation-editor__section-save"
						onClick={onSave}
						disabled={saving}
					>
						{saving ? 'Guardando...' : 'Guardar sección'}
					</button>
				)}
			</div>
		</section>
	);
}
