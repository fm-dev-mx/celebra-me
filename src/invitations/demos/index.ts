import type { DemoInvitationDocument } from '@/lib/invitation/demo-invitation';
import xvCelestialBlue from './demo-xv-celestial-blue/invitation';
import xvEnchantedRose from './demo-xv-enchanted-rose/invitation';
import xvEditorial from './demo-xv-editorial/invitation';
import xvLanternGarden from './demo-xv-lantern-garden/invitation';
import bodaBrisa from './demo-brisa/invitation';
import bautizoAngelicPresence from './demo-bautizo-angelic-presence/invitation';
import primeraComunionAngelicPresence from './demo-primera-comunion-angelic-presence/invitation';
import cumpleLuxuryHacienda from './demo-cumple-luxury-hacienda/invitation';

/** Every demo folder, in showroom order. A test keeps this list equal to the folders on disk. */
export const DEMO_INVITATIONS: readonly DemoInvitationDocument[] = [
	xvCelestialBlue,
	xvEnchantedRose,
	xvEditorial,
	xvLanternGarden,
	bodaBrisa,
	bautizoAngelicPresence,
	primeraComunionAngelicPresence,
	cumpleLuxuryHacienda,
];
