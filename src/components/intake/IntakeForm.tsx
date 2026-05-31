import type { FC } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';
import { useIntakeForm } from '@/hooks/use-intake-form';
import IntakeStepNav from '@/components/intake/IntakeStepNav';
import IntakeSummary from '@/components/intake/IntakeSummary';
import { INTAKE_BLOCK_COMPONENTS } from '@/components/intake/block-components';

interface Props {
	mode?: 'client' | 'internal';
	token?: string;
	projectId?: string;
	enabledBlocks: IntakeBlockType[];
	initialBlockData: Record<string, unknown>;
	initialStatus: string;
	isLocked: boolean;
	projectTitle: string;
}

const IntakeForm: FC<Props> = ({
	token,
	mode = 'client',
	projectId,
	enabledBlocks,
	initialBlockData,
	initialStatus,
	isLocked,
	projectTitle,
}) => {
	const form = useIntakeForm({
		token,
		mode,
		projectId,
		enabledBlocks,
		initialBlockData,
		initialStatus,
		isLocked,
	});

	if (form.submitted) {
		return (
			<div className="intake-form__success">
				<h2 className="intake-form__success-title">
					{mode === 'internal' ? 'Captura guardada' : 'Captura enviada'}
				</h2>
				<p className="intake-form__success-text">
					{mode === 'internal'
						? 'Los cambios internos se guardaron correctamente.'
						: 'Gracias por enviar tu información. Tu administrador la revisará pronto. Si necesitas hacer cambios, espera a que te contacten.'}
				</p>
			</div>
		);
	}

	if (form.isLocked) {
		return (
			<div className="intake-form__locked">
				<h2 className="intake-form__locked-title">Formulario en revision</h2>
				<p className="intake-form__locked-text">
					Tu administrador esta revisando tu captura. No puedes hacer cambios en este
					momento. Si se necesitan ajustes, te contactaran para que puedas editar.
				</p>
			</div>
		);
	}

	const BlockComponent = form.currentBlockType
		? INTAKE_BLOCK_COMPONENTS[form.currentBlockType]
		: null;
	const currentData = (form.blockData[form.currentBlockType] ?? {}) as Record<string, unknown>;

	return (
		<div className="intake-form">
			<header className="intake-form__header">
				<h1 className="intake-form__title">{projectTitle}</h1>
				<p className="intake-form__subtitle">
					{mode === 'internal' ? 'Edición interna' : 'Captura de información'}
				</p>
			</header>

			<IntakeStepNav
				steps={form.enabledBlocks}
				currentStep={form.currentStep}
				onStepClick={form.goToStep}
				disabled={form.saving || form.submitting}
			/>

			<div className="intake-form__body">
				{form.showSummary ? (
					<IntakeSummary
						blockData={form.blockData}
						enabledBlocks={form.enabledBlocks}
						clientComments={form.clientComments}
						onCommentsChange={form.setClientComments}
						onEdit={form.goToStep}
						onSubmit={form.submit}
						submitting={form.submitting}
					/>
				) : (
					<>
						{BlockComponent && (
							<BlockComponent
								data={currentData}
								onChange={(field, value) =>
									form.updateBlockField(form.currentBlockType, field, value)
								}
								disabled={form.saving}
							/>
						)}

						{form.errors[form.currentBlockType] && (
							<p className="intake-form__error">
								{form.errors[form.currentBlockType]}
							</p>
						)}

						{form.errors._submit && (
							<p className="intake-form__error">{form.errors._submit}</p>
						)}
					</>
				)}
			</div>

			{!form.showSummary && (
				<footer className="intake-form__footer">
					<button
						type="button"
						className="intake-form__btn intake-form__btn--secondary"
						onClick={form.prevStep}
						disabled={form.currentStep === 0 || form.saving}
					>
						Anterior
					</button>
					<button
						type="button"
						className="intake-form__btn intake-form__btn--primary"
						onClick={form.nextStep}
						disabled={form.saving}
					>
						{form.saving
							? 'Guardando...'
							: form.currentStep === form.totalSteps - 1
								? 'Revisar'
								: 'Siguiente'}
					</button>
				</footer>
			)}

			{!form.showSummary && (
				<div className="intake-form__progress">
					Paso {form.currentStep + 1} de {form.totalSteps}
				</div>
			)}
		</div>
	);
};

export default IntakeForm;
