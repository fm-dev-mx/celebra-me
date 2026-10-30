import type { DraftContent } from '@/lib/intake/schemas/invitation-content-draft.schema';
import { INVITATION_DATA_STEPS } from '@/lib/invitation-data/form';

export default function OrderDraftSource({ source }: { source: DraftContent['orderSource'] }) {
	if (!source) return null;
	return (
		<details className="dashboard-card">
			<summary>
				Datos originales del pedido{source.packageName ? ` · ${source.packageName}` : ''}
			</summary>
			<p>
				Revise el borrador antes de publicar. Complete la estructura visual y asigne un
				propietario mediante el flujo de preparación. El itinerario y los regalos conservan
				el texto original para que usted los estructure; la canción requiere un archivo de
				audio.
			</p>
			<dl>
				{INVITATION_DATA_STEPS.flatMap((step) => step.fields).map((field) => {
					const value = source.answers[field.name];
					return typeof value === 'string' && value ? (
						<div key={field.name}>
							<dt>{field.label}</dt>
							<dd>{value}</dd>
						</div>
					) : null;
				})}
			</dl>
		</details>
	);
}
