import { useEffect, useRef, useState } from 'react';

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
	const dragging = useRef(false);
	const [customMode, setCustomMode] = useState(() => {
		return (
			value && !FOCAL_PRESETS.flat().includes(value as (typeof FOCAL_PRESETS)[number][number])
		);
	});

	const isCustomValue =
		value && !FOCAL_PRESETS.flat().includes(value as (typeof FOCAL_PRESETS)[number][number]);
	useEffect(() => {
		setCustomMode(isCustomValue);
	}, [isCustomValue]);

	const isValid = !value || isValidFocalPoint(value);
	const focalPos = isValid ? value || 'center' : 'center';

	const handlePreset = (preset: string) => {
		onChange(preset);
		setCustomMode(false);
	};

	const updateFromPosition = (element: HTMLDivElement, clientX: number, clientY: number) => {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
		const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
		onChange(`${Math.round(x)}% ${Math.round(y)}%`);
		setCustomMode(true);
	};

	return (
		<div className="focal-point-control">
			{imageSrc && (
				<div
					className="focal-point-control__preview"
					role="application"
					tabIndex={0}
					aria-label="Seleccionar punto focal"
					onPointerDown={(event) => {
						dragging.current = true;
						event.currentTarget.setPointerCapture?.(event.pointerId);
						updateFromPosition(event.currentTarget, event.clientX, event.clientY);
					}}
					onPointerMove={(event) => {
						if (dragging.current) {
							updateFromPosition(event.currentTarget, event.clientX, event.clientY);
						}
					}}
					onPointerUp={() => {
						dragging.current = false;
					}}
					onClick={(event) => {
						if (!dragging.current) {
							updateFromPosition(event.currentTarget, event.clientX, event.clientY);
						}
					}}
				>
					<img
						src={imageSrc}
						alt={alt ?? 'Vista previa del punto focal'}
						className="focal-point-control__preview-img"
						// eslint-disable-next-line no-restricted-syntax -- dynamic object-position from user input
						style={{ objectPosition: focalPos } as React.CSSProperties}
					/>
				</div>
			)}
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
