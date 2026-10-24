/**
 * `pnpm board` commands that keep the store light (d185–d187): they remove or move board data, so each one
 * lists what it would do first and changes nothing until asked.
 */
import { say } from './cli.mjs';
import { pruneBackups, withLock } from './store.mjs';

export const maintenanceCommands = {
	/** d185: backup copies over the newest 2 per document, or of finished tasks; only --aplicar removes them. */
	'prune-backups'({ flags }, dir, out) {
		return withLock(dir, () => {
			const r = pruneBackups(dir, { aplicar: flags.aplicar === true && !flags['dry-run'] });
			const kb = (r.bytes / 1024).toFixed(0);
			const head = `${r.aplicado ? 'Quitados' : 'Sobran'} ${r.sobran.length} respaldos (${kb} KB).`;
			const tail = r.aplicado || !r.sobran.length ? [] : ['Para quitarlos: --aplicar'];
			const text = [head, ...r.sobran.map((x) => `  ${x.archivo}`), ...tail].join('\n');
			say(flags, out, r, text);
		});
	},
};
