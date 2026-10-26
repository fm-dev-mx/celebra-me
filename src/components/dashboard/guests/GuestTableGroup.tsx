import React, { useId } from 'react';
import { ChevronDownGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import { GUEST_TABLE_COL_COUNT } from '@/components/dashboard/guests/GuestTable';
import {
	getGuestSectionNote,
	type GuestStatusSection,
} from '@/components/dashboard/guests/guest-presenter';
import type { BatchFlowKind } from '@/components/dashboard/guests/use-guest-dashboard-actions';

export interface GuestTableGroupBatch {
	kind: BatchFlowKind;
	guestIds: ReadonlySet<string>;
}

interface GuestTableGroupProps {
	section: GuestStatusSection;
	collapsed: boolean;
	onToggle: () => void;
	/** Group-wide action; only offered when it reaches two or more guests. */
	batch?: GuestTableGroupBatch;
	onRequestBatch?: (kind: BatchFlowKind, guestIds: ReadonlySet<string>) => void;
	children: React.ReactNode;
}

function batchLabel({ kind, guestIds }: GuestTableGroupBatch): string {
	return kind === 'reminder'
		? `Recordar a los ${guestIds.size}`
		: `Enviar a los ${guestIds.size}`;
}

/** One status group of the desktop table: a tinted, collapsible header over its rows. */
const GuestTableGroup: React.FC<GuestTableGroupProps> = ({
	section,
	collapsed,
	onToggle,
	batch,
	onRequestBatch,
	children,
}) => {
	const rowsId = useId();
	const note = getGuestSectionNote(section);
	const showBatch = batch && onRequestBatch && batch.guestIds.size >= 2;

	return (
		<>
			<tbody className={`guest-table-group guest-table-group--${section.bucket}`}>
				<tr className="guest-table-group__header">
					<th colSpan={GUEST_TABLE_COL_COUNT} scope="colgroup">
						<div className="guest-table-group__bar">
							<button
								type="button"
								className="guest-table-group__toggle"
								aria-expanded={!collapsed}
								aria-controls={rowsId}
								onClick={onToggle}
							>
								<ChevronDownGlyph
									size={18}
									className={`guest-table-group__chevron${collapsed ? ' guest-table-group__chevron--collapsed' : ''}`}
								/>
								<span className="guest-table-group__title">{section.title}</span>
								<span className="guest-table-group__count">
									{section.items.length}
								</span>
							</button>
							{note && <span className="guest-table-group__note">{note}</span>}
							{showBatch && (
								<button
									type="button"
									className="guest-table-group__batch"
									onClick={() => onRequestBatch(batch.kind, batch.guestIds)}
								>
									{batchLabel(batch)}
								</button>
							)}
						</div>
					</th>
				</tr>
			</tbody>
			<tbody id={rowsId} className="guest-table-group__rows" hidden={collapsed}>
				{!collapsed && children}
			</tbody>
		</>
	);
};

export default GuestTableGroup;
