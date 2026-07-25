import { createClient } from '@supabase/supabase-js';
import { resolveLocalEnv } from './provision/local-provision-env.ts';
import { initCloudinary } from './provision/cloudinary-adapter.ts';
import { v2 as cloudinary } from 'cloudinary';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  console.log('Generating sanitized rollback journal...');
  const env = resolveLocalEnv();
  const supabase = createClient(env.apiUrl, env.serviceRoleKey);

  const { data: inv } = await supabase
    .from('invitations')
    .select('id, slug')
    .eq('slug', 'abril-michelle-becerra-rea')
    .single();

  const { data: dbAssets } = inv
    ? await supabase.from('invitation_assets').select('*').eq('invitation_id', inv.id)
    : { data: [] };

  const { data: pubContent } = inv
    ? await supabase
        .from('published_invitation_content')
        .select('*')
        .eq('invitation_project_id', inv.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  initCloudinary();

  const cRes = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'xv/abril-michelle-becerra-rea/assets',
    max_results: 50,
    context: true,
  });

  const journal = {
    generatedAt: new Date().toISOString(),
    invitation: inv,
    publishedVersion: pubContent?.version ?? null,
    publishedContent: pubContent?.content ?? null,
    databaseAssets: dbAssets,
    cloudinaryResources: cRes.resources.map((r: any) => ({
      asset_id: r.asset_id,
      public_id: r.public_id,
      folder: r.folder ?? r.asset_folder ?? '',
      version: r.version,
      format: r.format,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      url: r.url,
      secure_url: r.secure_url,
      context: r.context,
    })),
  };

  const logsDir = resolve(process.cwd(), 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  const filePath = resolve(logsDir, 'cloudinary-rollback-abril.json');
  writeFileSync(filePath, JSON.stringify(journal, null, 2), 'utf8');
  console.log(`Sanitized rollback journal successfully saved to: ${filePath}`);
}

main().catch(console.error);
