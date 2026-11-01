import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DISPOSABLE_DB_URL } from './db-target-config.ts';
import { runPsql, runPsqlAsync } from './db-workflow-lib.ts';

// Fixed disposable target only; no environment-selected or hosted connection.
const customerId = randomUUID();
const orderId = randomUUID();
const slug = `order-draft-race-${orderId}`;
const sql = (statement: string) =>
	runPsql(statement, DISPOSABLE_DB_URL, { asCommand: true, noPsqlrc: true }).stdout.trim();
const call = `select public.create_order_invitation_draft('${orderId}',
  (select updated_at from public.invitation_data_requests where order_id = '${orderId}'),
  '${slug}', 'editorial', '{"title":"Race fixture","eventType":"xv"}'::jsonb);`;

try {
	sql(`insert into public.customers (id, display_name) values ('${customerId}', 'Synthetic race');
    insert into public.sales_orders (id, order_number, customer_id, event_type, total_amount, status)
      values ('${orderId}', '${slug}', '${customerId}', 'xv', 1800, 'paid');
    insert into public.invitation_data_requests (order_id, token_hash, expires_at, status, submitted_at, answers)
      values ('${orderId}', replace('${randomUUID()}${randomUUID()}', '-', ''), now() + interval '1 day', 'submitted', now(),
      '{"celebrantNames":"Race fixture","eventDate":"2026-12-12"}');`);
	// One caller holds the order lock until its transaction ends; the second must reuse its result.
	const results = await Promise.all([
		runPsqlAsync(
			`begin; set local role service_role; ${call} select pg_sleep(0.3); commit;`,
			DISPOSABLE_DB_URL,
			{ asCommand: true, noPsqlrc: true },
		),
		runPsqlAsync(`set role service_role; ${call}`, DISPOSABLE_DB_URL, {
			asCommand: true,
			noPsqlrc: true,
		}),
	]);
	for (const result of results) assert.equal(result.status, 0, result.stderr);
	const output = results.map((result) => result.stdout).join('\n');
	assert.equal((output.match(/"created": true/g) ?? []).length, 1);
	assert.equal((output.match(/"created": false/g) ?? []).length, 1);
	assert.equal(sql(`select count(*) from public.invitations where slug = '${slug}';`), '1');
	assert.equal(
		sql(
			`select count(*) from public.invitation_content_drafts where invitation_project_id = (select invitation_id from public.sales_orders where id = '${orderId}');`,
		),
		'1',
	);
	console.info('Order draft concurrency: PASS (two callers, one invitation, one draft).');
} finally {
	sql(`delete from public.invitation_data_requests where order_id = '${orderId}';
    delete from public.sales_orders where id = '${orderId}';
    delete from public.invitations where slug = '${slug}';
    delete from public.customers where id = '${customerId}';`);
}
