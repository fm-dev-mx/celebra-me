export class RevealManager {
	private audio: HTMLAudioElement | null = null;
	private eventSlug: string;
	private audioUrl: string;
	private storageKey: string;
	private isDemoInvitation: boolean;
	private devSkipEnabled: boolean;

	constructor(config: {
		eventSlug: string;
		audioUrl: string;
		isDemoInvitation: boolean;
		devSkipEnabled: boolean;
	}) {
		this.eventSlug = config.eventSlug;
		this.audioUrl = config.audioUrl;
		this.isDemoInvitation = config.isDemoInvitation;
		this.devSkipEnabled = config.devSkipEnabled;
		this.storageKey = `envelope-opened-${this.eventSlug}`;

		window.addEventListener('pagehide', () => this.cleanupAudio(), { once: true });

		if (this.audioUrl) {
			try {
				this.audio = new Audio(this.audioUrl);
				this.audio.preload = 'auto';
				this.audio.volume = 0.4;
			} catch {
				// Fallback for environments without Audio support
			}
		}
	}

	private getStoredFlag(key: string): boolean {
		try {
			return window.localStorage.getItem(key) === 'true';
		} catch {
			return false;
		}
	}

	public setStoredFlag(): void {
		if (this.isDemoInvitation) return;
		try {
			window.localStorage.setItem(this.storageKey, 'true');
		} catch {
			// Storage can fail in private mode
		}
	}

	public shouldSkipEnvelope(): boolean {
		const params = new URLSearchParams(window.location.search);
		const canUseDevSkip = this.devSkipEnabled && params.get('skipEnvelope') === 'true';
		const shouldRespectStoredReveal =
			!this.isDemoInvitation &&
			params.get('forceEnvelope') !== 'true' &&
			this.getStoredFlag(this.storageKey);

		return canUseDevSkip || shouldRespectStoredReveal;
	}

	public playOpenSound(): void {
		if (!this.audio) return;

		try {
			this.audio.currentTime = 0;
			void this.audio.play().catch(() => {});
		} catch {
			// Ignore playback failures
		}
	}

	private cleanupAudio(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
	}
}

export const getMotionPreference = () =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;
