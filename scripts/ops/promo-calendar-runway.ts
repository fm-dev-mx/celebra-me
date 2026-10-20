#!/usr/bin/env node
/**
 * Weekly check that the promo calendar still covers the coming weeks.
 *
 *   pnpm ops:promo-runway
 *
 * Fails when the calendar is invalid or when its last row ends within PROMO_RUNWAY_ALERT_DAYS, so
 * the workflow can open a reminder issue while there is still time to add and release the next row.
 * Outside every row the landing page falls back to regular prices; nothing breaks, but the owner
 * should decide on purpose.
 */

import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	getScheduleRunway,
	PROMO_RUNWAY_ALERT_DAYS,
	validatePromoSchedule,
} from '../../src/data/promo-campaign.data.ts';

export interface RunwayResult {
	ok: boolean;
	detail: string;
}

export function checkPromoRunway(now: Date = new Date()): RunwayResult {
	const problems = validatePromoSchedule();
	if (problems.length > 0) {
		return {
			ok: false,
			detail: `El calendario de promociones tiene errores: ${problems.join('; ')}`,
		};
	}
	const runway = getScheduleRunway(now);
	if (!runway || runway.daysLeft === 0) {
		return {
			ok: false,
			detail: 'No hay ninguna promoción programada: la portada muestra el precio regular.',
		};
	}
	const detail = `La última promoción programada termina el ${runway.endLabel} (faltan ${runway.daysLeft} días).`;
	if (runway.daysLeft <= PROMO_RUNWAY_ALERT_DAYS) {
		return {
			ok: false,
			detail: `${detail} Agregue la siguiente fila al calendario y publíquela.`,
		};
	}
	return { ok: true, detail };
}

function main(): void {
	const { ok, detail } = checkPromoRunway();
	const line = `${ok ? 'OK' : 'ALERTA'}: ${detail}`;
	console.log(line);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
	}
	if (!ok) process.exit(1);
}

if (process.argv[1] && /^promo-calendar-runway\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main();
}
