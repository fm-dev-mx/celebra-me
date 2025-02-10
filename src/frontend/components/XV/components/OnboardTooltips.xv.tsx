// src/frontend/components/XV/components/OnboardTooltips.xv.tsx
import React, { useState, useEffect, useRef } from 'react';
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
	const [step, setStep] = useState<number>(1);
	const [position, setPosition] = useState<TooltipPosition | null>(null);
	const observerRef = useRef<MutationObserver | null>(null);

	// Compute the tooltip’s position based on its target element’s bounding rectangle.
	const updateTooltipPosition = (targetId: string) => {
		const target = document.getElementById(targetId);
		if (target) {
			const rect = target.getBoundingClientRect();
			const placement: 'top' | 'bottom' = rect.top > 60 ? 'top' : 'bottom';
			const left = rect.left + rect.width / 2;
			const top = placement === 'top' ? rect.top : rect.bottom;
			setPosition({ top, left, placement });
		}
	};

	// Handle step changes and position updates.
	useEffect(() => {
		if (step > 0 && step <= steps.length) {
			const targetId = steps[step - 1].targetId;
			const target = document.getElementById(targetId);

			if (target) {
				updateTooltipPosition(targetId);
			} else {
				// Use MutationObserver to wait for the target element to appear in the DOM.
				const observer = new MutationObserver(() => {
					const newTarget = document.getElementById(targetId);
					if (newTarget) {
						updateTooltipPosition(targetId);
						observer.disconnect(); // Stop observing once the target is found.
					}
				});

				observer.observe(document.body, { childList: true, subtree: true });
				observerRef.current = observer;
			}
		} else {
			setPosition(null);
		}

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, [step]);

	// Hide tooltip on scroll.
	useEffect(() => {
		const handleScroll = () => {
			if (step === 1) {
				// Automatically advance to the next step when the first tooltip is closed by scrolling.
				setStep(2);
			} else {
				setStep(0); // Hide the tooltip for other steps.
			}
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, [step]);

	// Listen for custom events to advance steps.
	useEffect(() => {
		const handlePlayClick = () => {
			if (step === 1) {
				setStep(2);
			}
		};

		const handleSectionClick = () => {
			if (step === 2) {
				setStep(0);
			}
		};

		window.addEventListener('onboarding-play-click', handlePlayClick);
		window.addEventListener('onboarding-section-click', handleSectionClick);

		return () => {
			window.removeEventListener('onboarding-play-click', handlePlayClick);
			window.removeEventListener('onboarding-section-click', handleSectionClick);
		};
	}, [step]);

	// Handle tooltip click to hide it and advance to the next step.
	const handleTooltipClick = () => {
		if (step === 1) {
			setStep(2); // Advance to the second tooltip.
		} else {
			setStep(0); // Hide the tooltip for other steps.
		}
	};

	// Render nothing if the tooltip is hidden or position is not set.
	if (step === 0 || !position) return null;

	return (
		<div
			className={`onboarding-tooltip ${position.placement}`}
			style={{
				position: 'fixed',
				top: position.top,
				left: position.left,
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
