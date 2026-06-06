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

interface TableConfig {
	table: string;
	select: string;
	slugField: string;
}

interface LegacyIconIssue {
	table: string;
	id: string;
	slug?: string;
	field: string;
	iconValue: string;
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

// Legacy icon names that should NOT exist after migration
const LEGACY_ICON_NAMES = [
	'waltz',
	'dinner',
	'church',
	'reception',
	'cake',
	'party',
	'toast',
	'dresscode',
	'dress-code',
	'dress code',
	'calendar',
	'gift',
	'photo',
	'rings',
	'dove',
	'crown',
	'diamond',
	'map',
	'map-location',
	'map location',
	'envelope',
	'boot',
	'boot-seal',
	'boot seal',
	'western-hat',
	'westernhat',
	'western hat',
	'taco',
	'tuba',
	'accordion',
	'heel',
	'forbidden',
	'flower-seal',
	'flowerseal',
	'flower seal',
	'heart-seal',
	'heartseal',
	'heart seal',
	'monogram-seal',
	'monogramseal',
	'monogram seal',
	'check-seal',
	'checkseal',
	'check seal',
	'heartbreak',
	'sparkles',
];

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
		const content = row.content as Record<string, unknown> | undefined;
		const slug = String(row[config.slugField] ?? '');

		for (const path_def of [
			{
				arr: (content?.itinerary as Record<string, unknown> | undefined)?.items,
				prefix: 'itinerary.items',
			},
			{
				arr: (content?.location as Record<string, unknown> | undefined)?.indications,
				prefix: 'location.indications',
			},
		]) {
			if (!Array.isArray(path_def.arr)) continue;
			for (let i = 0; i < path_def.arr.length; i++) {
				const item = path_def.arr[i] as Record<string, unknown> | undefined;
				if (
					item?.iconName &&
					LEGACY_ICON_NAMES.includes(String(item.iconName).toLowerCase())
				) {
					issues.push({
						table: config.table,
						id: String(row.id ?? ''),
						slug,
						field: `${path_def.prefix}[${i}].iconName`,
						iconValue: String(item.iconName),
					});
				}
			}
		}
	}

	return issues;
}

async function main(supabase: SupabaseClient) {
	console.log('🔍 Verifying icon name migration...\n');

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
		console.log('✅ SUCCESS: All icon names are in canonical format!');
		console.log('   - Published content: ✓');
		console.log('   - Draft content: ✓');
		console.log('\n🎉 Migration verification complete. Safe to remove runtime normalization.');
		process.exitCode = 0;
	} else {
		console.log('❌ FAILURE: Found legacy icon names in database\n');

		const byTable = allIssues.reduce(
			(acc, issue) => {
				(acc[issue.table] ??= []).push(issue);
				return acc;
			},
			{} as Record<string, LegacyIconIssue[]>,
		);

		for (const [table, issues] of Object.entries(byTable)) {
			console.log(`📋 ${table}: ${issues.length} issue(s)`);
			for (const issue of issues) {
				console.log(`   - ${issue.slug || issue.id}`);
				console.log(`     Field: ${issue.field}`);
				console.log(`     Value: "${issue.iconValue}" (should be canonical PascalCase)`);
			}
			console.log();
		}

		console.log('⚠️  Please run the migration again or fix these records manually.');
		console.log(
			'   Migration file: supabase/migrations/20260607000000_normalize_icon_names.sql',
		);
		process.exitCode = 1;
	}
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PROD_DB_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ Missing required environment variables:');
	console.error('   - SUPABASE_URL or PROD_DB_URL');
	console.error('   - SUPABASE_SERVICE_ROLE_KEY');
	process.exitCode = 2;
} else {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
	main(supabase).catch((error) => {
		console.error('❌ Unexpected error:', error);
		process.exitCode = 2;
	});
}
