import type { FC } from 'react';
import type { IntakeBlockType } from '@/lib/intake/types';

interface Props {
	steps: IntakeBlockType[];
	currentStep: number;
	onStepClick: (step: number) => void;
	disabled?: boolean;
}

const BLOCK_LABELS: Record<IntakeBlockType, string> = {
	'event-details': 'Detalles',
	'main-people': 'Personas',
	'date-locations': 'Ubicaciones',
	photos: 'Fotos',
	'rsvp-config': 'RSVP',
	music: 'Musica',
	gifts: 'Regalos',
	'special-messages': 'Mensajes',
};

const IntakeStepNav: FC<Props> = ({ steps, currentStep, onStepClick, disabled }) => {
	return (
		<nav className="intake-step-nav" aria-label="Pasos del formulario">
			<ol className="intake-step-nav__list">
				{steps.map((blockType, index) => {
					const isActive = index === currentStep;
					const isCompleted = index < currentStep;

					return (
						<li
							key={blockType}
							className={[
								'intake-step-nav__item',
								isActive ? 'intake-step-nav__item--active' : '',
								isCompleted ? 'intake-step-nav__item--completed' : '',
							].join(' ')}
						>
							<button
								type="button"
								className="intake-step-nav__button"
								onClick={() => onStepClick(index)}
								disabled={disabled}
								aria-current={isActive ? 'step' : undefined}
							>
								<span className="intake-step-nav__number">{index + 1}</span>
								<span className="intake-step-nav__label">
									{BLOCK_LABELS[blockType]}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
};

export default IntakeStepNav;
