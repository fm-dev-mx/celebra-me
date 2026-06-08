#!/usr/bin/env tsx
/**
 * Verification script for icon name migration
 *
 * This script checks all persisted content for legacy icon names.
 * It should be run AFTER the database migration to confirm all data is normalized.
 *
 * Exit codes:
 * - 0: All icon names are canonical (migration successful)
 * - 1: Legacy icon names found (migration incomplete)
 * - 2: Database connection error
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import type { IconName } from '../src/lib/icons/icon-catalog';
import { isIconName } from '../src/lib/icons/icon-catalog';

interface TableConfig {
	table: string;
	select: string;
	slugField: string;
}

export type IconMigrationIssueReason =
	| 'missing_iconName'
	| 'unknown_legacy_icon'
	| 'legacy_icon_present'
	| 'non_canonical_iconName'
	| 'unregistered_iconName'
	| 'invalid_icon_shape';

export interface LegacyIconIssue {
	table: string;
	id: string;
	slug?: string;
	field: string;
	iconValue: string;
	reason: IconMigrationIssueReason;
}

function loadEnvFile(relativePath: string): void {
	const fullPath = path.resolve(process.cwd(), relativePath);
	if (!fs.existsSync(fullPath)) return;
	const text = fs.readFileSync(fullPath, 'utf-8');
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		const value = trimmed.slice(eqIdx + 1).trim();
		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.prod.local');
loadEnvFile('.env.local');
loadEnvFile('.env');

type ContentRow = Record<string, unknown>;

const LEGACY_ICON_NAME_MAP: Record<string, IconName> = {
	accordion: 'Accordion',
	boot: 'BootSeal',
	'boot-seal': 'BootSeal',
	bootseal: 'BootSeal',
	cake: 'Cake',
	calendar: 'Calendar',
	'check-seal': 'CheckSeal',
	checkseal: 'CheckSeal',
	church: 'Church',
	crown: 'Crown',
	diamond: 'Diamond',
	dinner: 'Dinner',
	dove: 'Dove',
	dresscode: 'DressCode',
	'dress-code': 'DressCode',
	envelope: 'Enveloped',
	enveloped: 'Enveloped',
	'flower-seal': 'FlowerSeal',
	flowerseal: 'FlowerSeal',
	forbidden: 'Forbidden',
	gift: 'Gift',
	heartbreak: 'Heartbreak',
	'heart-seal': 'HeartSeal',
	heartseal: 'HeartSeal',
	heel: 'Heel',
	map: 'MapLocation',
	'map-location': 'MapLocation',
	maplocation: 'MapLocation',
	'monogram-seal': 'MonogramSeal',
	monogramseal: 'MonogramSeal',
	party: 'Party',
	photo: 'Photo',
	reception: 'Reception',
	rings: 'Rings',
	sparkles: 'Sparkles',
	taco: 'Taco',
	toast: 'Toast',
	tuba: 'Tuba',
	waltz: 'Waltz',
	'western-hat': 'WesternHat',
	westernhat: 'WesternHat',
};

function normalizeLegacyIconName(value: unknown): IconName | undefined {
	if (typeof value !== 'string') return undefined;
	const key = value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
	return LEGACY_ICON_NAME_MAP[key];
}

function legacyIconIssue(
	row: ContentRow,
	table: string,
	slug: string,
	field: string,
	iconValue: unknown,
	reason: IconMigrationIssueReason,
): LegacyIconIssue {
	return {
		table,
		id: String(row.id ?? ''),
		slug,
		field,
		iconValue: String(iconValue ?? ''),
		reason,
	};
}

function findIconNameIssueReason(value: unknown): IconMigrationIssueReason | undefined {
	if (typeof value !== 'string') return 'invalid_icon_shape';
	if (isIconName(value)) return undefined;
	return normalizeLegacyIconName(value) ? 'non_canonical_iconName' : 'unregistered_iconName';
}

export function findInvalidItineraryIconIssues(
	row: ContentRow,
	table = 'unknown',
	slugField = 'slug',
): LegacyIconIssue[] {
	const issues: LegacyIconIssue[] = [];
	const content = row.content as Record<string, unknown> | undefined;
	const slug = String(row[slugField] ?? row.slug ?? row.invitation_project_id ?? '');
	const items = (content?.itinerary as Record<string, unknown> | undefined)?.items;

	if (!Array.isArray(items)) return issues;

	for (let i = 0; i < items.length; i++) {
		const item = items[i] as Record<string, unknown> | undefined;
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			issues.push(
				legacyIconIssue(
					row,
					table,
					slug,
					`itinerary.items[${i}]`,
					'',
					'invalid_icon_shape',
				),
			);
			continue;
		}

		if (item.icon !== undefined) {
			issues.push(
				legacyIconIssue(
					row,
					table,
					slug,
					`itinerary.items[${i}].icon`,
					item.icon,
					'legacy_icon_present',
				),
			);
		}

		if (item.iconName !== undefined) {
			const reason = findIconNameIssueReason(item.iconName);
			if (reason) {
				issues.push(
					legacyIconIssue(
						row,
						table,
						slug,
						`itinerary.items[${i}].iconName`,
						item.iconName,
						reason,
					),
				);
			}
			continue;
		}

		issues.push(
			legacyIconIssue(
				row,
				table,
				slug,
				`itinerary.items[${i}].iconName`,
				item.icon ?? '',
				item.icon === undefined || normalizeLegacyIconName(item.icon)
					? 'missing_iconName'
					: 'unknown_legacy_icon',
			),
		);
	}

	return issues;
}

function findInvalidIndicationIconIssues(
	row: ContentRow,
	table: string,
	slugField: string,
): LegacyIconIssue[] {
	const issues: LegacyIconIssue[] = [];
	const content = row.content as Record<string, unknown> | undefined;
	const slug = String(row[slugField] ?? row.slug ?? row.invitation_project_id ?? '');
	const indications = (content?.location as Record<string, unknown> | undefined)?.indications;

	if (!Array.isArray(indications)) return issues;

	for (let i = 0; i < indications.length; i++) {
		const item = indications[i] as Record<string, unknown> | undefined;
		const reason = findIconNameIssueReason(item?.iconName);
		if (!reason) continue;
		issues.push(
			legacyIconIssue(
				row,
				table,
				slug,
				`location.indications[${i}].iconName`,
				item?.iconName,
				reason,
			),
		);
	}

	return issues;
}

async function checkTable(
	supabase: SupabaseClient,
	config: TableConfig,
): Promise<LegacyIconIssue[]> {
	const issues: LegacyIconIssue[] = [];

	const { data, error } = await supabase.from(config.table).select(config.select);

	if (error) {
		console.error(`❌ Error fetching ${config.table}:`, error.message);
		return issues;
	}

	for (const row of (data as unknown as Record<string, unknown>[]) || []) {
		issues.push(...findInvalidItineraryIconIssues(row, config.table, config.slugField));
		issues.push(...findInvalidIndicationIconIssues(row, config.table, config.slugField));
	}

	return issues;
}

async function main(supabase: SupabaseClient) {
	console.info('🔍 Verifying icon name migration...\n');

	const tables: TableConfig[] = [
		{ table: 'published_invitation_content', select: 'id, slug, content', slugField: 'slug' },
		{
			table: 'invitation_content_drafts',
			select: 'id, invitation_project_id, content',
			slugField: 'invitation_project_id',
		},
	];

	const results = await Promise.all(tables.map((cfg) => checkTable(supabase, cfg)));
	const allIssues = results.flat();

	if (allIssues.length === 0) {
		console.info('✅ SUCCESS: Itinerary icon data uses only canonical iconName values!');
		console.info('   - No legacy itinerary icon keys remain');
		console.info('   - Published content: ✓');
		console.info('   - Draft content: ✓');
		console.info('\n🎉 Migration verification complete.');
		process.exitCode = 0;
	} else {
		console.info('❌ FAILURE: Found legacy icon names in database\n');

		const byTable = allIssues.reduce(
			(acc, issue) => {
				(acc[issue.table] ??= []).push(issue);
				return acc;
			},
			{} as Record<string, LegacyIconIssue[]>,
		);

		for (const [table, issues] of Object.entries(byTable)) {
			console.info(`📋 ${table}: ${issues.length} issue(s)`);
			for (const issue of issues) {
				console.info(`   - ${issue.slug || issue.id}`);
				console.info(`     Field: ${issue.field}`);
				console.info(`     Value: "${issue.iconValue}"`);
				console.info(`     Reason: ${issue.reason}`);
			}
			console.info();
		}

		console.info('⚠️  Please run the migration again or fix these records manually.');
		console.info(
			'   Migration file: supabase/migrations/20260607211553_backfill_legacy_itinerary_icons_and_ayrin_location.sql',
		);
		process.exitCode = 1;
	}
}

function isExecutedDirectly(): boolean {
	return path.basename(process.argv[1] ?? '') === 'verify-icon-migration.ts';
}

if (isExecutedDirectly()) {
	const SUPABASE_URL =
		process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.PROD_DB_URL;
	const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		console.error('❌ Missing required environment variables:');
		console.error('   - SUPABASE_URL, PUBLIC_SUPABASE_URL, or PROD_DB_URL');
		console.error('   - SUPABASE_SERVICE_ROLE_KEY');
		process.exitCode = 2;
	} else {
		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		main(supabase).catch((error) => {
			console.error('❌ Unexpected error:', error);
			process.exitCode = 2;
		});
	}
}
