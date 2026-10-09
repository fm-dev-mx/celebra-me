import React from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import { CheckGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import type { BatchFlowKind } from '@/components/dashboard/guests/use-guest-dashboard-actions';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestBatchConfirmProps {
	kind: BatchFlowKind;
	guests: DashboardGuestItem[];
	onConfirm: () => void;
	onClose: () => void;
}

const MAX_LISTED = 6;

export function getBatchConfirmCopy(kind: BatchFlowKind, count: number) {
	const isOne = count === 1;
	if (kind === 'reminder') {
		return {
			title: isOne ? '¿Recordar a 1 invitado?' : `¿Recordar a ${count} invitados?`,
			confirm: 'Sí, recordar ahora',
		};
	}
	return {
		title: isOne ? '¿Enviar 1 invitación?' : `¿Enviar ${count} invitaciones?`,
		confirm: 'Sí, enviar ahora',
	};
}

/** What the one-by-one send screen lets the host adjust for each guest. */
export function getBatchEditableItems(count: number): string[] {
	const items = [
		'Corregir el nombre',
		'Ajustar cuántas personas vienen',
		'Agregar o cambiar el teléfono',
		'Editar el mensaje',
	];
	// "Enviar después" only appears while more than one guest is queued.
	if (count > 1) items.push('Dejar a alguien para después');
	return items;
}

/** Last check before a one-by-one batch: who receives it and what will happen. */
const GuestBatchConfirm: React.FC<GuestBatchConfirmProps> = ({
	kind,
	guests,
	onConfirm,
	onClose,
}) => {
	const copy = getBatchConfirmCopy(kind, guests.length);
	const listed = guests.slice(0, MAX_LISTED);
	const remaining = guests.length - listed.length;
	const editable = getBatchEditableItems(guests.length);

	return (
		<ModalShell
			title={copy.title}
			className="guest-batch-confirm"
			fullscreenOnMobile={false}
			initialFocus="heading"
			onClose={onClose}
			descriptionId="guest-batch-confirm-help"
			footer={
				<>
					<button type="button" className="btn-secondary" onClick={onClose}>
						No, regresar
					</button>
					<button type="button" className="btn-primary" onClick={onConfirm}>
						{copy.confirm}
					</button>
				</>
			}
		>
			<div className="dashboard-modal__content">
				{/* 1. What happens */}
				<p id="guest-batch-confirm-help" className="guest-batch-confirm__lead">
					Le mostraremos un invitado a la vez con el mensaje listo para WhatsApp.
				</p>

				{/* 2. Who receives it: the thing being confirmed */}
				<section
					className="guest-batch-confirm__section"
					aria-labelledby="guest-batch-confirm-recipients"
				>
					<h4 id="guest-batch-confirm-recipients" className="guest-batch-confirm__label">
						{guests.length === 1 ? 'Lo recibirá' : 'Lo recibirán'}
						<span className="guest-batch-confirm__count">{guests.length}</span>
					</h4>
					<ul className="guest-batch-confirm__list">
						{listed.map((guest) => (
							<li key={guest.guestId} className="guest-batch-confirm__item">
								<CheckGlyph size={20} />
								<span>{guest.fullName}</span>
							</li>
						))}
					</ul>
					{remaining > 0 && (
						<p className="guest-batch-confirm__more">
							{remaining === 1 ? 'y 1 invitado más' : `y ${remaining} invitados más`}
						</p>
					)}
				</section>

				{/* 3. Reassurance: nothing is final until each send */}
				<section
					className="guest-batch-confirm__options"
					aria-labelledby="guest-batch-confirm-options"
				>
					<h4
						id="guest-batch-confirm-options"
						className="guest-batch-confirm__options-title"
					>
						Antes de cada envío, puede:
					</h4>
					<ul className="guest-batch-confirm__options-list">
						{editable.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
			</div>
		</ModalShell>
	);
};

export default GuestBatchConfirm;
