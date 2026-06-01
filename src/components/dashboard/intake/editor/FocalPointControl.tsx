import { useState } from 'react';

const FOCAL_PRESETS = [
	['top left', 'top center', 'top right'],
	['center left', 'center center', 'center right'],
	['bottom left', 'bottom center', 'bottom right'],
] as const;

const FOCAL_LABELS: Record<string, string> = {
	'top left': 'Superior izquierda',
	'top center': 'Superior centro',
	'top right': 'Superior derecha',
	'center left': 'Centro izquierda',
	'center center': 'Centro',
	'center right': 'Centro derecha',
	'bottom left': 'Inferior izquierda',
	'bottom center': 'Inferior centro',
	'bottom right': 'Inferior derecha',
};

function isValidFocalPoint(value: string): boolean {
	return /^(?:\d+(?:\.\d+)?%|left|center|right)(?:\s+(?:\d+(?:\.\d+)?%|top|center|bottom))?$/.test(
		value,
	);
}

interface Props {
	value: string;
	onChange: (value: string) => void;
	imageSrc?: string;
	alt?: string;
}

export default function FocalPointControl({ value, onChange, imageSrc, alt }: Props) {
	const [customMode, setCustomMode] = useState(() => {
		return (
			value && !FOCAL_PRESETS.flat().includes(value as (typeof FOCAL_PRESETS)[number][number])
		);
	});

	const isValid = !value || isValidFocalPoint(value);
	const focalPos = isValid ? value || 'center' : 'center';
	// eslint-disable-next-line no-restricted-syntax -- dynamic object-position from user input
	const focalImg = (
		<img
			src={imageSrc}
			alt={alt ?? 'Vista previa del punto focal'}
			className="focal-point-control__preview-img"
			style={{ objectPosition: focalPos } as React.CSSProperties}
		/>
	);

	const handlePreset = (preset: string) => {
		onChange(preset);
		setCustomMode(false);
	};

	return (
		<div className="focal-point-control">
			{imageSrc && <div className="focal-point-control__preview">{focalImg}</div>}
			<div className="focal-point-control__grid">
				{FOCAL_PRESETS.map((row, rowIndex) => (
					<div className="focal-point-control__row" key={rowIndex}>
						{row.map((preset) => (
							<button
								type="button"
								key={preset}
								className={`focal-point-control__btn${value === preset ? ' focal-point-control__btn--active' : ''}`}
								onClick={() => handlePreset(preset)}
								title={FOCAL_LABELS[preset] ?? preset}
								aria-label={FOCAL_LABELS[preset] ?? preset}
								data-focal={preset.replace(' ', '-')}
							/>
						))}
					</div>
				))}
			</div>
			<div className="focal-point-control__custom">
				{customMode ? (
					<label className="focal-point-control__field">
						<span>Punto focal personalizado</span>
						<input
							type="text"
							value={value}
							onChange={(e) => onChange(e.target.value)}
							placeholder="ej. 50% 40%"
							className={isValid ? '' : 'focal-point-control__field--error'}
						/>
						{!isValid && (
							<span className="focal-point-control__error">
								Formato inválido. Usa porcentajes (50% 40%) o posiciones (center
								top).
							</span>
						)}
					</label>
				) : (
					<button
						type="button"
						className="focal-point-control__custom-toggle"
						onClick={() => setCustomMode(true)}
					>
						Valor personalizado
					</button>
				)}
			</div>
		</div>
	);
}
