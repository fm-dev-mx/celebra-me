// src/frontend/components/XV/components/OnboardTooltips.xv.tsx
import React, { useState, useEffect } from 'react';
import '@styles/XV/onboarding-tooltips.scss';

interface TooltipPosition {
	top: number;
	left: number;
	placement: 'top' | 'bottom';
}

interface TooltipStep {
	targetId: string;
	message: string;
}

const steps: TooltipStep[] = [
	{
		targetId: 'music-toggle',
		message: 'Presiona play y deja que la música te acompañe.',
	},
	{
		targetId: 'section-nav-button',
		message: 'Sigue viendo todos los detalles del evento.',
	},
];

const OnboardingTooltips: React.FC = () => {
	// Start at step 1. Set to 0 to hide.
	const [step, setStep] = useState<number>(1);
	const [position, setPosition] = useState<TooltipPosition | null>(null);

	// Compute the tooltip’s position based on its target element’s bounding rectangle.
	const updateTooltipPosition = (targetId: string) => {
		const target = document.getElementById(targetId);
		if (target) {
			const rect = target.getBoundingClientRect();
			// Choose placement: if there’s enough space above, place tooltip on top; otherwise below.
			const placement: 'top' | 'bottom' = rect.top > 60 ? 'top' : 'bottom';
			// For simplicity, we position the tooltip at the horizontal center of the target.
			const left = rect.left + rect.width / 2;
			// For vertical positioning, use the target’s top or bottom.
			const top = placement === 'top' ? rect.top : rect.bottom;
			setPosition({ top, left, placement });
		}
	};

	// When the current step changes, update the tooltip’s position.
	useEffect(() => {
		if (step > 0 && step <= steps.length) {
			// Use requestAnimationFrame to defer position update until next repaint
			requestAnimationFrame(() => {
				updateTooltipPosition(steps[step - 1].targetId);
			});
		} else {
			setPosition(null);
		}
	}, [step]);

	// Update position on window resize. (Keep this for responsiveness)
	useEffect(() => {
		const handleResize = () => {
			if (step > 0 && step <= steps.length) {
				updateTooltipPosition(steps[step - 1].targetId);
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [step]);

	// Listen for the custom event dispatched from the play button.
	useEffect(() => {
		const handlePlayClick = () => {
			if (step === 1) {
				setStep(2);
			}
		};
		window.addEventListener('onboarding-play-click', handlePlayClick);
		return () => window.removeEventListener('onboarding-play-click', handlePlayClick);
	}, [step]);

	// **Nuevo:** Escucha el evento disparado al hacer click en SectionNavButton.
	useEffect(() => {
		const handleSectionClick = () => {
			if (step === 2) {
				setStep(0);
			}
		};
		window.addEventListener('onboarding-section-click', handleSectionClick);
		return () => window.removeEventListener('onboarding-section-click', handleSectionClick);
	}, [step]);

	// Haciendo click en el tooltip mismo también lo oculta.
	const handleTooltipClick = () => {
		setStep(0);
	};

	// **New: Handle scroll event to hide tooltip**
	useEffect(() => {
		const handleScroll = () => {
			setStep(0); // Hide the tooltip on scroll
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []); // Empty dependency array ensures this effect runs only on mount and unmount

	// If step is 0 or we have no position, render nothing.
	if (step === 0 || !position) return null;

	return (
		<div
			className={`onboarding-tooltip ${position.placement}`}
			style={{
				position: 'fixed',
				top: position.top,
				left: position.left,
				/**
				 * When placed on top, translate upward (with extra offset for the arrow);
				 * when placed on bottom, translate downward.
				 */
				transform:
					position.placement === 'top'
						? 'translate(-50%, -110%)'
						: 'translate(-50%, 10%)',
			}}
			onClick={handleTooltipClick}
		>
			<div className="onboarding-tooltip__content">{steps[step - 1].message}</div>
			<div className="onboarding-tooltip__arrow" />
		</div>
	);
};

export default OnboardingTooltips;
