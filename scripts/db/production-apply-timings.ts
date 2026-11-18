/** Run-local monotonic measurements; never part of a plan's authorization fingerprint. */
export interface ProductionApplyTiming {
	phase: 'plan' | 'backup' | 'schema' | 'publication' | 'verification';
	id?: string;
	durationMs: number;
	status: 'completed' | 'failed';
}

export class ProductionApplyTimings {
	readonly rows: ProductionApplyTiming[] = [];

	constructor(private readonly now: () => number = () => performance.now()) {}

	start(phase: ProductionApplyTiming['phase'], id?: string): (failed?: boolean) => void {
		const started = this.now();
		return (failed = false) => {
			this.rows.push({
				phase,
				...(id === undefined ? {} : { id }),
				durationMs: Math.max(0, this.now() - started),
				status: failed ? 'failed' : 'completed',
			});
		};
	}

	async measure<T>(
		phase: ProductionApplyTiming['phase'],
		work: () => T | Promise<T>,
		id?: string,
	): Promise<T> {
		const finish = this.start(phase, id);
		try {
			const result = await work();
			finish();
			return result;
		} catch (error) {
			finish(true);
			throw error;
		}
	}

	measureSync<T>(phase: ProductionApplyTiming['phase'], work: () => T, id?: string): T {
		const finish = this.start(phase, id);
		try {
			const result = work();
			finish();
			return result;
		} catch (error) {
			finish(true);
			throw error;
		}
	}
}

export function formatProductionApplyTimings(rows: readonly ProductionApplyTiming[]): string {
	if (rows.length === 0) return '';
	const labels: Record<ProductionApplyTiming['phase'], string> = {
		plan: 'Plan',
		backup: 'Respaldo',
		schema: 'Esquema',
		publication: 'Publicación',
		verification: 'Verificación de imágenes',
	};
	return [
		'Tiempos por fase',
		'Fase | Invitación / etapa | Duración (s) | Estado',
		...rows.map(
			(row) =>
				`${labels[row.phase]} | ${row.id ?? '—'} | ${(row.durationMs / 1000).toFixed(3)} | ${row.status === 'failed' ? 'Falló' : 'Completada'}`,
		),
		'Las fases no ejecutadas no aparecen. Plan incluye reconstrucciones. Esquema y publicación incluyen controles internos y respaldos anidados; no sume las filas. La espera de confirmación no se mide.',
	].join('\n');
}
