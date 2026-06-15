import { useState, useEffect, useRef } from 'react';
import { getPresetsForSection, type PresetSection } from '@/lib/intake/text-presets';
import { isEventType } from '@/lib/theme/theme-contract';

interface Props {
	section: PresetSection;
	eventType?: string;
	onSelect: (text: string) => void;
}

export default function TextPresetPicker({ section, eventType, onSelect }: Props) {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const presets = getPresetsForSection(
		section,
		eventType && isEventType(eventType) ? eventType : undefined,
	);

	useEffect(() => {
		if (!open) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.parentElement?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [open]);

	if (presets.length === 0) return null;

	return (
		<div className="text-preset-picker">
			<button
				type="button"
				className="text-preset-picker__toggle"
				onClick={() => setOpen(!open)}
				title="Frases sugeridas"
				aria-label="Frases sugeridas"
			>
				✦
			</button>
			{open && (
				<div className="text-preset-picker__menu" ref={menuRef}>
					{presets.map((preset) => (
						<button
							type="button"
							key={preset.id}
							className="text-preset-picker__item"
							onClick={() => {
								onSelect(preset.text);
								setOpen(false);
							}}
						>
							<span className="text-preset-picker__item-label">{preset.label}</span>
							<span className="text-preset-picker__item-text">{preset.text}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
