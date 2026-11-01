/**
 * Synthesized envelope-open cue: a paper slide as the flap turns and a soft three-note chime as
 * the letter rises. Built with Web Audio inside the opening tap (keeps the user activation that
 * autoplay policies require), so it ships no audio file. iOS keeps it silent under the ringer
 * switch. Failures are swallowed: the reveal never depends on sound.
 */

import { isFramedPreview } from '@/lib/invitation/music-session';

type AudioContextCtor = typeof AudioContext;

const PAPER_START_S = 0.24;
const PAPER_LENGTH_S = 0.55;
const CHIME_START_S = 0.95;
const CHIME_NOTES_HZ = [1568, 2093, 2637];
const CHIME_STAGGER_S = 0.11;
const CHIME_DECAY_S = 1.6;
const MASTER_GAIN = 0.22;
const CLOSE_AFTER_MS = 3600;

const resolveAudioContext = (): AudioContextCtor | null => {
	const scope = window as typeof window & { webkitAudioContext?: AudioContextCtor };
	return scope.AudioContext ?? scope.webkitAudioContext ?? null;
};

const createNoiseBuffer = (context: AudioContext, seconds: number) => {
	const length = Math.ceil(context.sampleRate * seconds);
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const data = buffer.getChannelData(0);
	for (let index = 0; index < length; index += 1) {
		data[index] = Math.random() * 2 - 1;
	}
	return buffer;
};

const schedulePaperSlide = (context: AudioContext, destination: AudioNode, at: number) => {
	const source = context.createBufferSource();
	source.buffer = createNoiseBuffer(context, PAPER_LENGTH_S);

	const band = context.createBiquadFilter();
	band.type = 'bandpass';
	band.Q.value = 0.8;
	band.frequency.setValueAtTime(900, at);
	band.frequency.exponentialRampToValueAtTime(3200, at + PAPER_LENGTH_S);

	const gain = context.createGain();
	gain.gain.setValueAtTime(0.0001, at);
	gain.gain.exponentialRampToValueAtTime(0.5, at + 0.06);
	gain.gain.exponentialRampToValueAtTime(0.18, at + 0.3);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + PAPER_LENGTH_S);

	source.connect(band).connect(gain).connect(destination);
	source.start(at);
	source.stop(at + PAPER_LENGTH_S);
};

const scheduleChime = (context: AudioContext, destination: AudioNode, at: number) => {
	CHIME_NOTES_HZ.forEach((frequency, index) => {
		const start = at + index * CHIME_STAGGER_S;
		const oscillator = context.createOscillator();
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(frequency, start);

		const gain = context.createGain();
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.32 / (index + 1), start + 0.012);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + CHIME_DECAY_S);

		oscillator.connect(gain).connect(destination);
		oscillator.start(start);
		oscillator.stop(start + CHIME_DECAY_S);
	});
};

export const playEnvelopeOpenChime = (): void => {
	// Framed previews (landing showroom, dashboard) open in silence.
	if (isFramedPreview()) return;
	const Context = resolveAudioContext();
	if (!Context) return;

	try {
		const context = new Context();
		const master = context.createGain();
		master.gain.value = MASTER_GAIN;
		master.connect(context.destination);

		const now = context.currentTime;
		schedulePaperSlide(context, master, now + PAPER_START_S);
		scheduleChime(context, master, now + CHIME_START_S);

		void context.resume().catch(() => {});
		window.setTimeout(() => {
			void context.close().catch(() => {});
		}, CLOSE_AFTER_MS);
	} catch {
		// Sound is decorative; ignore unsupported or blocked audio.
	}
};
