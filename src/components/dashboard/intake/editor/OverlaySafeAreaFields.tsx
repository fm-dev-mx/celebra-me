import { useEffect, useState } from 'react';
import Field from '@/components/dashboard/intake/editor/Field';
import { overlaySafeAreaSchema } from '@/lib/schemas/content/shared.schema';

export type OverlaySafeAreaValue = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type Draft = {
	x: string;
	y: string;
	width: string;
	height: string;
};

const KEYS = ['x', 'y', 'width', 'height'] as const;

function toDraft(value: OverlaySafeAreaValue | undefined): Draft {
	return {
		x: value ? String(value.x) : '',
		y: value ? String(value.y) : '',
		width: value ? String(value.width) : '',
		height: value ? String(value.height) : '',
	};
}

function parseCoord(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (trimmed === '') return undefined;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : undefined;
}

interface Props {
	value: OverlaySafeAreaValue | undefined;
	onChange: (next: OverlaySafeAreaValue | undefined) => void;
}

/**
 * Drafts four normalized 0–1 coords locally and only commits a complete
 * schema-valid area (or clears when all empty). Partial edits stay in the
 * draft UI without writing invalid thank-you payloads.
 */
export default function OverlaySafeAreaFields({ value, onChange }: Props) {
	const [draft, setDraft] = useState<Draft>(() => toDraft(value));

	useEffect(() => {
		setDraft(toDraft(value));
	}, [value]);

	const updateField = (key: (typeof KEYS)[number], raw: string) => {
		const nextDraft = { ...draft, [key]: raw };
		setDraft(nextDraft);

		const parsed = {
			x: parseCoord(nextDraft.x),
			y: parseCoord(nextDraft.y),
			width: parseCoord(nextDraft.width),
			height: parseCoord(nextDraft.height),
		};

		if (KEYS.every((k) => parsed[k] === undefined)) {
			onChange(undefined);
			return;
		}
		if (KEYS.some((k) => parsed[k] === undefined)) {
			return;
		}

		const candidate = {
			x: parsed.x as number,
			y: parsed.y as number,
			width: parsed.width as number,
			height: parsed.height as number,
		};
		const result = overlaySafeAreaSchema.safeParse(candidate);
		if (result.success) {
			onChange(result.data);
		}
	};

	return (
		<div className="invitation-editor__stack">
			<p className="invitation-editor__hint">
				Coordenadas normalizadas de 0 a 1 sobre la imagen. Debe completar las cuatro
				medidas con un área válida (ancho y alto ≥ 0.01; x+ancho y y+alto ≤ 1).
			</p>
			<div className="invitation-editor__field-grid">
				<Field
					label="Área segura X"
					type="number"
					min={0}
					max={1}
					step={0.01}
					value={draft.x}
					onChange={(v) => updateField('x', v)}
				/>
				<Field
					label="Área segura Y"
					type="number"
					min={0}
					max={1}
					step={0.01}
					value={draft.y}
					onChange={(v) => updateField('y', v)}
				/>
				<Field
					label="Ancho de área segura"
					type="number"
					min={0.01}
					max={1}
					step={0.01}
					value={draft.width}
					onChange={(v) => updateField('width', v)}
				/>
				<Field
					label="Alto de área segura"
					type="number"
					min={0.01}
					max={1}
					step={0.01}
					value={draft.height}
					onChange={(v) => updateField('height', v)}
				/>
			</div>
		</div>
	);
}
