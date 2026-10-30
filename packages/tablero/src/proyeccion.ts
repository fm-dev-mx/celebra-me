// Reads the store once and builds the projection every reader shares.

import type { Config } from './config.ts';
import type { Store } from './core/store.ts';
import { lineaDeTiempo, type LineaDeTiempo } from './core/timeline.ts';

export function proyectarLinea(store: Store, config: Config, ahora = new Date()): LineaDeTiempo {
	const desde = new Date(ahora.getTime() - config.hechoDias * 86_400_000);
	return lineaDeTiempo(store.tareas(), store.bitacora(desde), store.bandeja(), config, ahora);
}
