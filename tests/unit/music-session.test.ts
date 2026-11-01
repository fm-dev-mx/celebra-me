import {
	isFramedPreview,
	joinMusicChannel,
	MUSIC_CHANNEL_NAME,
} from '@/lib/invitation/music-session';

/** In-memory BroadcastChannel: delivers to every other channel of the same name. */
class FakeChannel extends EventTarget {
	static open: FakeChannel[] = [];
	constructor(readonly name: string) {
		super();
		FakeChannel.open.push(this);
	}
	postMessage(data: unknown) {
		FakeChannel.open
			.filter((other) => other !== this && other.name === this.name)
			.forEach((other) => other.dispatchEvent(new MessageEvent('message', { data })));
	}
}

const Channel = FakeChannel as unknown as new (name: string) => BroadcastChannel;

describe('music session', () => {
	beforeEach(() => {
		FakeChannel.open = [];
	});

	it('pauses every other player when one starts', () => {
		const landing = jest.fn();
		const demoTab = jest.fn();
		joinMusicChannel(landing, Channel);
		const announceDemo = joinMusicChannel(demoTab, Channel);

		announceDemo();

		expect(landing).toHaveBeenCalledTimes(1);
		expect(demoTab).not.toHaveBeenCalled();
		expect(FakeChannel.open.every((channel) => channel.name === MUSIC_CHANNEL_NAME)).toBe(true);
	});

	it('is a no-op without BroadcastChannel', () => {
		expect(() => joinMusicChannel(jest.fn(), undefined)()).not.toThrow();
	});

	it('tells a framed preview from the top window', () => {
		expect(isFramedPreview(window)).toBe(false);
		expect(isFramedPreview({ self: {}, top: {} } as unknown as Window)).toBe(true);
	});
});
