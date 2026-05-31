import type { FC, ReactNode } from 'react';
import type { EventType } from '@/lib/theme/theme-contract';
import type { IntakeBlockType } from '@/lib/intake/types';
import { useIntakeForm } from '@/hooks/use-intake-form';
import IntakeStepNav from '@/components/intake/IntakeStepNav';
import IntakeSummary from '@/components/intake/IntakeSummary';
import { INTAKE_BLOCK_COMPONENTS } from '@/components/intake/block-components';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';

interface Props {
	mode?: 'client' | 'admin';
	token?: string;
	invitationId?: string;
	enabledBlocks: IntakeBlockType[];
	initialBlockData: Record<string, unknown>;
	initialStatus: string;
	isLocked: boolean;
	invitationTitle: string;
	eventType: EventType;
}

const IntakeForm: FC<Props> = ({
	token,
	mode = 'client',
	invitationId,
	enabledBlocks,
	initialBlockData,
	initialStatus,
	isLocked,
	invitationTitle,
	eventType,
}) => {
	const form = useIntakeForm({
		token,
		mode,
		invitationId,
		enabledBlocks,
		initialBlockData,
		initialStatus,
		isLocked,
	});

	if (form.submitted) {
		return (
			<div className="intake-form__success">
				<h2 className="intake-form__success-title">Captura enviada</h2>
				<p className="intake-form__success-text">
					Gracias por enviar tu información. Tu administrador la revisará pronto. Si
					necesitas hacer cambios, espera a que te contacten.
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

	const formFallback: ReactNode = (
		<div className="intake-form__error">
			<h3>Error al cargar el formulario</h3>
			<p>Ocurrió un error inesperado. Intenta recargar la página.</p>
		</div>
	);

	return (
		<div className="intake-form">
			<header className="intake-form__header">
				<h1 className="intake-form__title">{invitationTitle}</h1>
				<p className="intake-form__subtitle">
					{mode === 'admin' ? 'Edición interna' : 'Captura de información'}
				</p>
			</header>

			<ErrorBoundary fallback={formFallback}>
				{form.saved && (
					<p className="intake-form__success-text">
						Los cambios internos se guardaron correctamente.
					</p>
				)}
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
							mode={mode}
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
									eventType={eventType}
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
			</ErrorBoundary>

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
