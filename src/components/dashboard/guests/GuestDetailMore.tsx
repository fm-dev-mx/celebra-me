import React, { useState } from 'react';
import { ChevronDownGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import GuestTagChips from '@/components/dashboard/guests/GuestTagChips';
import {
	formatGuestDateShort,
	formatGuestEntrySource,
	formatGuestOpens,
	getGuestGroups,
} from '@/components/dashboard/guests/guest-presenter';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestDetailMoreProps {
	item: DashboardGuestItem;
	onUpdateGroups?: (guestId: string, groups: string[]) => Promise<void>;
}

/** Inline group editor: chips plus explicit save, so a stray tap never changes data. */
const GroupEditor: React.FC<{
	initial: string[];
	onSave: (groups: string[]) => Promise<void>;
	onCancel: () => void;
}> = ({ initial, onSave, onCancel }) => {
	const [draft, setDraft] = useState(initial);
	const [saving, setSaving] = useState(false);
	return (
		<div className="guest-detail-more__group-editor">
			<GuestTagChips value={draft} onChange={setDraft} label="Grupos" disabled={saving} />
			<div className="guest-detail-more__group-actions">
				<button
					type="button"
					className="btn-primary btn--compact"
					disabled={saving}
					onClick={async () => {
						setSaving(true);
						await onSave(draft);
						setSaving(false);
					}}
				>
					{saving ? 'Guardando…' : 'Guardar grupo'}
				</button>
				<button type="button" className="guest-detail-more__link" onClick={onCancel}>
					Cancelar
				</button>
			</div>
		</div>
	);
};

/** Secondary facts (group, dates, origin). Collapsed on phones, open where there is room. */
const GuestDetailMore: React.FC<GuestDetailMoreProps> = ({ item, onUpdateGroups }) => {
	const roomy = useMediaQuery('(min-width: 768px)') === true;
	const [toggled, setToggled] = useState<boolean | null>(null);
	const [editingGroups, setEditingGroups] = useState(false);
	const open = toggled ?? roomy;
	const groups = getGuestGroups(item);
	const panelId = `guest-more-${item.guestId}`;

	const rows: Array<[string, string | null]> = [
		['Enviada', item.firstSharedAt ? formatGuestDateShort(item.firstSharedAt) : null],
		['Vista previa', item.lastPreviewedAt ? 'Sí, en el chat' : null],
		['Abierta', formatGuestOpens(item)],
		[
			'Recorrido',
			(item.maxProgressMilestone ?? 0) > 0 ? `${item.maxProgressMilestone} %` : null,
		],
		['Respondió', item.respondedAt ? formatGuestDateShort(item.respondedAt) : null],
		['Origen', formatGuestEntrySource(item)],
		['Correo', item.email ?? null],
	];

	return (
		<section className="guest-detail-more">
			<button
				type="button"
				className="guest-detail-more__toggle"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setToggled(!open)}
			>
				<span>Más datos</span>
				{!open && <span className="guest-detail-more__hint">grupo, fechas, origen</span>}
				<ChevronDownGlyph
					size={18}
					className={`guest-detail-more__chevron${open ? ' guest-detail-more__chevron--open' : ''}`}
				/>
			</button>
			{open && (
				<dl id={panelId} className="guest-detail-more__list">
					<dt>Grupo</dt>
					<dd>
						{editingGroups && onUpdateGroups ? (
							<GroupEditor
								initial={groups}
								onCancel={() => setEditingGroups(false)}
								onSave={async (next) => {
									await onUpdateGroups(item.guestId, next);
									setEditingGroups(false);
								}}
							/>
						) : (
							<span className="guest-detail-more__groups">
								{groups.length > 0
									? groups.map((group) => (
											<span
												key={group}
												className="guest-tag guest-tag--group"
											>
												{group}
											</span>
										))
									: 'Sin grupo'}
								{onUpdateGroups && (
									<button
										type="button"
										className="guest-detail-more__link"
										onClick={() => setEditingGroups(true)}
									>
										Cambiar
									</button>
								)}
							</span>
						)}
					</dd>
					{rows
						.filter(([, value]) => value)
						.map(([label, value]) => (
							<React.Fragment key={label}>
								<dt>{label}</dt>
								<dd>{value}</dd>
							</React.Fragment>
						))}
				</dl>
			)}
		</section>
	);
};

export default GuestDetailMore;
