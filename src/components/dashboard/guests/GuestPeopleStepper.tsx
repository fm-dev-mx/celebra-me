import React from 'react';

interface GuestPeopleStepperProps {
	id: string;
	/** Raw text so the host can clear the field while typing a larger number. */
	value: string;
	max: number;
	onChange: (value: string) => void;
	describedBy?: string;
	invalid?: boolean;
}

/** Large −/+ control for party size; the number stays editable for big families. */
const GuestPeopleStepper: React.FC<GuestPeopleStepperProps> = ({
	id,
	value,
	max,
	onChange,
	describedBy,
	invalid,
}) => {
	const current = parseInt(value, 10);
	const safe = Number.isNaN(current) ? 1 : current;
	const step = (delta: number) => onChange(String(Math.min(max, Math.max(1, safe + delta))));

	return (
		<div className="guest-people-stepper">
			<button
				type="button"
				className="guest-people-stepper__button"
				aria-label="Una persona menos"
				aria-controls={id}
				disabled={safe <= 1}
				onClick={() => step(-1)}
			>
				<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
					<path
						d="M5 12h14"
						stroke="currentColor"
						strokeWidth="2.4"
						strokeLinecap="round"
					/>
				</svg>
			</button>
			<input
				id={id}
				type="number"
				inputMode="numeric"
				className="guest-people-stepper__input"
				min={1}
				max={max}
				value={value}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
			<button
				type="button"
				className="guest-people-stepper__button guest-people-stepper__button--add"
				aria-label="Una persona más"
				aria-controls={id}
				disabled={safe >= max}
				onClick={() => step(1)}
			>
				<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
					<path
						d="M12 5v14M5 12h14"
						stroke="currentColor"
						strokeWidth="2.4"
						strokeLinecap="round"
					/>
				</svg>
			</button>
		</div>
	);
};

export default GuestPeopleStepper;
