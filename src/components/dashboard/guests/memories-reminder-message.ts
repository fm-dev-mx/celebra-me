import type { DashboardMemoriesReminder } from '@/interfaces/dashboard/guest.interface';

function formatUploadDeadline(reminder: DashboardMemoriesReminder): string {
	try {
		return new Intl.DateTimeFormat('es-MX', {
			day: 'numeric',
			month: 'long',
			timeZone: reminder.timeZone,
		}).format(new Date(reminder.uploadEndsAt));
	} catch {
		return '';
	}
}

/**
 * Built-in post-event message asking guests for their photos. `{{enlace}}` is the
 * photo space URL (passed as the composer's inviteUrl), not the invitation link.
 */
export function buildMemoriesReminderTemplate(reminder: DashboardMemoriesReminder): string {
	const deadline = formatUploadDeadline(reminder);
	const closing = deadline
		? `Puedes subirlos hasta el ${deadline}. ¡Gracias por ser parte de este día!`
		: '¡Gracias por ser parte de este día!';
	return [
		'¡Hola {{invitado}}! 📸',
		'Gracias por acompañarnos en {{evento}}. Nos encantaría ver la celebración a través de tus ojos: comparte tus fotos y videos aquí, sin descargar ninguna app:',
		'{{enlace}}',
		'',
		closing,
	].join('\n');
}
