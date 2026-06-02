import { useRef, useState } from 'react';

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

type DeviceKey = 'mobile' | 'tablet' | 'desktop';

const DEVICE_LABELS: Record<DeviceKey, string> = {
	mobile: 'Móvil',
	tablet: 'Tableta',
	desktop: 'Escritorio',
};

function isValidFocalPoint(value: string): boolean {
	return /^(?:\d+(?:\.\d+)?%|left|center|right)(?:\s+(?:\d+(?:\.\d+)?%|top|center|bottom))?$/.test(
		value,
	);
}

const FOCAL_POINT_VARS: Record<DeviceKey, string> = {
	mobile: '--gallery-item-focal-point-mobile',
	tablet: '--gallery-item-focal-point-tablet',
	desktop: '--gallery-item-focal-point-desktop',
};

function parseFocalPoint(value: string): { x: number; y: number } | null {
	if (!value) return null;
	const defaultCenter = { x: 50, y: 50 };
	const keywordMap: Record<string, number> = {
		left: 0, center: 50, right: 100,
		top: 0, bottom: 100,
	};
	const parts = value.trim().split(/\s+/);
	if (parts.length === 0) return defaultCenter;
	if (parts.length === 1) {
		if (parts[0] in keywordMap) {
			const val = keywordMap[parts[0]];
			return parts[0] === 'top' || parts[0] === 'bottom' || parts[0] === 'center'
				? { x: 50, y: val }
				: { x: val, y: 50 };
		}
		if (parts[0].endsWith('%')) {
			return { x: Math.round(parseFloat(parts[0])), y: 50 };
		}
		return defaultCenter;
	}
	if (parts.length >= 2) {
		const x = parts[0].endsWith('%') ? Math.round(parseFloat(parts[0])) : (keywordMap[parts[0]] ?? 50);
		const y = parts[1].endsWith('%') ? Math.round(parseFloat(parts[1])) : (keywordMap[parts[1]] ?? 50);
		return { x, y };
	}
	return defaultCenter;
}

interface Props {
	value: string;
	onChange: (value: string) => void;
	mobileValue?: string;
	onMobileChange?: (value: string) => void;
	tabletValue?: string;
	onTabletChange?: (value: string) => void;
	desktopValue?: string;
	onDesktopChange?: (value: string) => void;
	mode: 'shared' | 'per-device';
	onModeChange: (mode: 'shared' | 'per-device') => void;
	imageSrc?: string;
	alt?: string;
}

function resolveCurrentValue(
	mode: 'shared' | 'per-device',
	activeDevice: DeviceKey,
	sharedValue: string,
	mobileValue?: string,
	tabletValue?: string,
	desktopValue?: string,
): string {
	if (mode !== 'per-device') return sharedValue;
	if (activeDevice === 'mobile') return mobileValue ?? '';
	if (activeDevice === 'tablet') return tabletValue ?? '';
	return desktopValue ?? '';
}

function resolveCurrentOnChange(
	mode: 'shared' | 'per-device',
	activeDevice: DeviceKey,
	sharedOnChange: (value: string) => void,
	onMobileChange?: (value: string) => void,
	onTabletChange?: (value: string) => void,
	onDesktopChange?: (value: string) => void,
): (value: string) => void {
	if (mode !== 'per-device') return sharedOnChange;
	if (activeDevice === 'mobile') return onMobileChange ?? sharedOnChange;
	if (activeDevice === 'tablet') return onTabletChange ?? sharedOnChange;
	return onDesktopChange ?? sharedOnChange;
}

function ImagePreview({ imageSrc, alt, previewVar, focalPos, coords, dragging, updateFromPosition }: {
	imageSrc: string;
	alt: string;
	previewVar: string;
	focalPos: string;
	coords: { x: number; y: number } | null;
	dragging: { current: boolean };
	updateFromPosition: (element: HTMLDivElement, clientX: number, clientY: number) => void;
}) {
	return (
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
				alt={alt}
				className="focal-point-control__preview-img"
				// eslint-disable-next-line no-restricted-syntax -- dynamic CSS custom property from user input
				style={{ [previewVar]: focalPos } as React.CSSProperties}
			/>
			{coords && (
				<div
					className="focal-point-control__crosshair"
					// eslint-disable-next-line no-restricted-syntax -- dynamic position from user input
					style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
				>
					<div className="focal-point-control__crosshair-line focal-point-control__crosshair-line--x" />
					<div className="focal-point-control__crosshair-line focal-point-control__crosshair-line--y" />
					<div className="focal-point-control__crosshair-dot" />
				</div>
			)}
		</div>
	);
}

export default function FocalPointControl({
	value,
	onChange,
	mobileValue,
	onMobileChange,
	tabletValue,
	onTabletChange,
	desktopValue,
	onDesktopChange,
	mode,
	onModeChange,
	imageSrc,
	alt,
}: Props) {
	const dragging = useRef(false);
	const [activeDevice, setActiveDevice] = useState<DeviceKey>('mobile');
	const [showCustomInput, setShowCustomInput] = useState(false);

	const currentValue = resolveCurrentValue(mode, activeDevice, value, mobileValue, tabletValue, desktopValue);

	const currentOnChange = resolveCurrentOnChange(mode, activeDevice, onChange, onMobileChange, onTabletChange, onDesktopChange);

	const customMode = showCustomInput ||
		(!!currentValue && !FOCAL_PRESETS.flat().includes(currentValue as (typeof FOCAL_PRESETS)[number][number]));

	const isValid = !currentValue || isValidFocalPoint(currentValue);
	const focalPos = isValid ? currentValue || 'center' : 'center';
	const coords = parseFocalPoint(focalPos);

	const updateFromPosition = (element: HTMLDivElement, clientX: number, clientY: number) => {
		if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const x = Math.round(((clientX - rect.left) / rect.width) * 100);
		const y = Math.round(((clientY - rect.top) / rect.height) * 100);
		currentOnChange(`${x}% ${y}%`);
		setShowCustomInput(true);
	};

	const handlePreset = (preset: string) => {
		currentOnChange(preset);
		setShowCustomInput(false);
	};

	const previewVar = mode === 'per-device'
		? FOCAL_POINT_VARS[activeDevice]
		: '--gallery-item-focal-point';

	return (
		<div className="focal-point-control">
			<div className="focal-point-control__mode-toggle">
				<label>
					<input
						type="checkbox"
						checked={mode === 'per-device'}
						onChange={(e) => onModeChange(e.target.checked ? 'per-device' : 'shared')}
					/>
					<span>Punto focal por dispositivo</span>
				</label>
			</div>
			{mode === 'per-device' && (
				<div className="focal-point-control__device-tabs">
					{(['mobile', 'tablet', 'desktop'] as const).map((device) => (
						<button
							type="button"
							key={device}
							className={`focal-point-control__device-tab${activeDevice === device ? ' focal-point-control__device-tab--active' : ''}`}
							onClick={() => setActiveDevice(device)}
						>
							{DEVICE_LABELS[device]}
						</button>
					))}
				</div>
			)}
			{coords && (
				<div className="focal-point-control__coords">
					X: {coords.x}% &nbsp; Y: {coords.y}%
				</div>
			)}
			{imageSrc && (
				<ImagePreview
					imageSrc={imageSrc}
					alt={alt ?? 'Vista previa del punto focal'}
					previewVar={previewVar}
					focalPos={focalPos}
					coords={coords}
					dragging={dragging}
					updateFromPosition={updateFromPosition}
				/>
			)}
			<div className="focal-point-control__grid">
				{FOCAL_PRESETS.map((row, rowIndex) => (
					<div className="focal-point-control__row" key={rowIndex}>
						{row.map((preset) => (
							<button
								type="button"
								key={preset}
								className={`focal-point-control__btn${currentValue === preset ? ' focal-point-control__btn--active' : ''}`}
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
							value={currentValue}
							onChange={(e) => currentOnChange(e.target.value)}
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
						onClick={() => setShowCustomInput(true)}
					>
						Valor personalizado
					</button>
				)}
			</div>
		</div>
	);
}