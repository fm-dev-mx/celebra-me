import type { FC } from 'react';
import type { DemoPreset } from '@/lib/intake/types';
import { DEMO_PRESET_CATALOG } from '@/lib/intake/demo-preset-catalog';

interface Props {
	eventType: string;
	selectedDemoId: string;
	onChange: (demoId: string) => void;
}

const DemoSelector: FC<Props> = ({ eventType, selectedDemoId, onChange }) => {
	const compatiblePresets = DEMO_PRESET_CATALOG.filter((p) => p.eventType === eventType);

	if (!eventType) {
		return (
			<div className="demo-selector">
				<p className="demo-selector__hint">Selecciona primero un tipo de evento.</p>
			</div>
		);
	}

	if (compatiblePresets.length === 0) {
		return (
			<div className="demo-selector">
				<p className="demo-selector__hint">
					No hay demos disponibles para este tipo de evento.
				</p>
			</div>
		);
	}

	return (
		<div className="demo-selector">
			<label className="intake-field__label">Demo base</label>
			<div className="demo-selector__grid">
				{compatiblePresets.map((preset: DemoPreset) => (
					<label
						key={preset.id}
						className={[
							'demo-selector__card',
							selectedDemoId === preset.id ? 'demo-selector__card--selected' : '',
						].join(' ')}
					>
						<input
							type="radio"
							name="baseDemoId"
							value={preset.id}
							checked={selectedDemoId === preset.id}
							onChange={() => onChange(preset.id)}
							className="demo-selector__radio"
						/>
						<span className="demo-selector__name">{preset.displayName}</span>
						<span className="demo-selector__theme">{preset.themeId}</span>
					</label>
				))}
			</div>
		</div>
	);
};

export default DemoSelector;
