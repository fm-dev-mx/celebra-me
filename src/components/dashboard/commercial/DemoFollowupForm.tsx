import { useRef, useState, type SubmitEvent } from 'react';
import { DashboardApiClient } from '@/lib/dashboard/api-client';
import { createLeadCode } from '@/lib/tracking/lead-code';
import { FOLLOWUP_ACTION_LABELS, LOSS_REASON_LABELS } from '@/lib/commercial/demo-followup';
import type { DemoInventoryItem } from '@/lib/tracking/demo-conversion-report';

export default function DemoFollowupForm({ inventory }: { inventory: DemoInventoryItem[] }) {
	const [leadCode, setLeadCode] = useState('');
	const [action, setAction] = useState('demo_shared');
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState('');
	const [failed, setFailed] = useState(false);
	const pending = useRef<{ signature: string; id: string; occurredAt: string } | null>(null);
	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) return;
		const form = new FormData(event.currentTarget);
		const fields = {
			leadCode,
			demoSlug: String(form.get('demoSlug')),
			action,
			lossReason: action === 'lost' ? String(form.get('lossReason')) : 'not_reported',
		};
		const signature = JSON.stringify(fields);
		if (pending.current?.signature !== signature)
			pending.current = {
				signature,
				id: crypto.randomUUID(),
				occurredAt: new Date().toISOString(),
			};
		setBusy(true);
		setStatus('Guardando…');
		setFailed(false);
		try {
			const result = await new DashboardApiClient().post(
				'/api/dashboard/commercial/demo-followups',
				{
					...fields,
					idempotencyKey: pending.current.id,
					occurredAt: pending.current.occurredAt,
				},
			);
			if (!result.ok) throw new Error(result.message);
			setStatus('Registro confirmado. Actualice el informe para ver los totales.');
		} catch {
			setFailed(true);
			setStatus('No se pudo confirmar el registro. Puede reintentar sin duplicarlo.');
		} finally {
			setBusy(false);
		}
	}
	return (
		<form onSubmit={submit} className="demo-followup-form">
			<h3>Registrar seguimiento</h3>
			<p>
				Use el mismo código para la misma oportunidad, aunque la conversación continúe sin
				pulsar un CTA. No incluya datos personales.
			</p>
			<fieldset disabled={busy}>
				<label>
					Código de oportunidad
					<input
						value={leadCode}
						onChange={(e) => setLeadCode(e.target.value.toUpperCase())}
						required
						pattern="CM-[A-Z0-9]{6}"
						maxLength={9}
					/>
				</label>
				<button
					type="button"
					className="btn-secondary"
					onClick={() => setLeadCode(createLeadCode())}
				>
					Nueva oportunidad
				</button>
				<label>
					Demo
					<select name="demoSlug" defaultValue="demo-xv-celestial-blue">
						{inventory.map((d) => (
							<option key={d.slug} value={d.slug}>
								{d.title}
							</option>
						))}
					</select>
				</label>
				<label>
					Acción confirmada
					<select value={action} onChange={(e) => setAction(e.target.value)}>
						{Object.entries(FOLLOWUP_ACTION_LABELS).map(([v, label]) => (
							<option key={v} value={v}>
								{label}
							</option>
						))}
					</select>
				</label>
				{action === 'lost' && (
					<label>
						Motivo
						<select name="lossReason">
							{Object.entries(LOSS_REASON_LABELS).map(([v, label]) => (
								<option key={v} value={v}>
									{label}
								</option>
							))}
						</select>
					</label>
				)}
				<button type="submit" className="btn-primary">
					{busy ? 'Guardando…' : 'Registrar acción'}
				</button>
			</fieldset>
			<p role={failed ? 'alert' : 'status'}>{status}</p>
		</form>
	);
}
