/**
 * How the RSVP form is presented:
 * - `form` (default): every field on one card, revealed as the guest answers.
 * - `steps`: one question per step (attendance, party, message) over the same form, hook and
 *   submission; the payload is identical.
 */
export const RSVP_FLOWS = ['form', 'steps'] as const;
export type RsvpFlow = (typeof RSVP_FLOWS)[number];
