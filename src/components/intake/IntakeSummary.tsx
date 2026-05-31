import type { FC } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';
import { BLOCK_LABELS } from '@/lib/intake/labels';

interface Props {
	blockData: Record<string, unknown>;
	enabledBlocks: IntakeBlockType[];
	clientComments: string;
	onCommentsChange: (value: string) => void;
	onEdit: (step: number) => void;
	onSubmit: () => void;
	submitting: boolean;
	disabled?: boolean;
	mode?: 'client' | 'internal';
}

function renderBlockSummary(_blockType: IntakeBlockType, data: unknown): React.ReactNode {
	if (!data || typeof data !== 'object') {
		return <p className="intake-summary__empty">Sin datos</p>;
	}

	const entries = Object.entries(data as Record<string, unknown>).filter(
		([key, value]) =>
			value !== '' && value !== undefined && value !== null && key !== '_pending',
	);

	if (entries.length === 0) {
		return <p className="intake-summary__empty">Sin datos</p>;
	}

	return (
		<dl className="intake-summary__fields">
			{entries.map(([key, value]) => (
				<div key={key} className="intake-summary__field">
					<dt className="intake-summary__key">{key}</dt>
					<dd className="intake-summary__value">
						{typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)}
					</dd>
				</div>
			))}
		</dl>
	);
}

const IntakeSummary: FC<Props> = ({
	blockData,
	enabledBlocks,
	clientComments,
	onCommentsChange,
	onEdit,
	onSubmit,
	submitting,
	disabled,
	mode = 'client',
}) => {
	return (
		<div className="intake-summary">
			<h3 className="intake-summary__title">
				{mode === 'internal' ? 'Resumen de datos base' : 'Resumen de tu captura'}
			</h3>
			<p className="intake-summary__description">
				{mode === 'internal'
					? 'Revisa la información antes de guardarla. Puedes regresar a cualquier paso para hacer cambios.'
					: 'Revisa la información antes de enviarla. Puedes regresar a cualquier paso para hacer cambios.'}
			</p>

			{enabledBlocks.map((blockType, index) => (
				<section key={blockType} className="intake-summary__section">
					<div className="intake-summary__section-header">
						<h4 className="intake-summary__section-title">{BLOCK_LABELS[blockType]}</h4>
						{!disabled && (
							<button
								type="button"
								className="intake-summary__edit-btn"
								onClick={() => onEdit(index)}
							>
								Editar
							</button>
						)}
					</div>
					{renderBlockSummary(blockType, blockData[blockType])}
				</section>
			))}

			<div className="intake-summary__comments">
				<label className="intake-field__label" htmlFor="clientComments">
					Comentarios adicionales (opcional)
				</label>
				<textarea
					id="clientComments"
					className="intake-field__textarea"
					value={clientComments}
					onChange={(e) => onCommentsChange(e.target.value)}
					placeholder="Alguna indicacion adicional que quieras compartir..."
					disabled={disabled}
					rows={4}
				/>
			</div>

			{!disabled && (
				<button
					type="button"
					className="intake-summary__submit-btn"
					onClick={onSubmit}
					disabled={submitting}
				>
					{submitting
						? mode === 'internal'
							? 'Guardando...'
							: 'Enviando...'
						: mode === 'internal'
							? 'Guardar datos base'
							: 'Enviar captura'}
				</button>
			)}
		</div>
	);
};

export default IntakeSummary;
