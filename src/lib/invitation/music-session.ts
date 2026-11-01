/**
 * Only one invitation song plays at a time on this site. A visitor can hear a demo inside the
 * landing showroom, then open the full demo in a new tab: when one starts, every other player on
 * the same origin (other tabs, the showroom frame, the dashboard preview) pauses.
 *
 * Inside a frame the song never starts by itself: the showroom and the dashboard preview are
 * previews, so the visitor asks for the music with the control (or the showroom's own button).
 */

export const MUSIC_CHANNEL_NAME = 'celebra-me:music';

interface MusicMessage {
	type: 'playing';
	id: string;
}

type ChannelCtor = new (name: string) => BroadcastChannel;

export const isFramedPreview = (win: Window = window): boolean => {
	try {
		return win.self !== win.top;
	} catch {
		// A cross-origin parent throws on `top` access: still a frame.
		return true;
	}
};

const newPlayerId = () =>
	globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Joins the site-wide music channel. `onOtherPlaying` runs when another player starts; the
 * returned `announcePlaying` tells the others this one started. Without BroadcastChannel both
 * are no-ops.
 */
export const joinMusicChannel = (
	onOtherPlaying: () => void,
	Channel: ChannelCtor | undefined = globalThis.BroadcastChannel,
): (() => void) => {
	if (typeof Channel !== 'function') return () => undefined;
	const id = newPlayerId();
	let channel: BroadcastChannel;
	try {
		channel = new Channel(MUSIC_CHANNEL_NAME);
	} catch {
		return () => undefined;
	}
	channel.addEventListener('message', (event: MessageEvent<MusicMessage>) => {
		if (event.data?.type === 'playing' && event.data.id !== id) onOtherPlaying();
	});
	return () => channel.postMessage({ type: 'playing', id } satisfies MusicMessage);
};
