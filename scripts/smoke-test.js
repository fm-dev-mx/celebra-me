import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Vercel output is at .vercel/output/static, but standard astro build is dist/
// Checking package.json 'preview' script says .vercel/output/static
// Let's check both or default to .vercel/output/static as per package.json
const distDir = path.resolve(__dirname, '../.vercel/output/static');

// ============================================================
// Required Files Check
// ============================================================
const requiredFiles = [
	'index.html',
	'xv/demo-xv/index.html',
	'_astro', // Asset directory
];

// ============================================================
// SEO Files Check (optional but important)
// ============================================================
const seoFiles = ['robots.txt', 'sitemap-index.xml'];

console.log(`\n🔍 Analyzing build output in: ${distDir}\n`);

if (!fs.existsSync(distDir)) {
	console.error(`❌ Build directory not found! Run 'pnpm build' first.`);
	process.exit(1);
}

let hasErrors = false;
let warnings = 0;

// ============================================================
// 1. Check Required Files
// ============================================================
console.log('📂 Checking required files...');
requiredFiles.forEach((file) => {
	const filePath = path.join(distDir, file);
	if (fs.existsSync(filePath)) {
		console.log(`  ✅ Found: ${file}`);
	} else if (file === 'index.html') {
		console.warn(`  ⚠️ Missing: ${file} (Expected if the Home page is Server-Rendered/SSR)`);
		warnings++;
	} else {
		console.error(`  ❌ Missing: ${file}`);
		hasErrors = true;
	}
});

// ============================================================
// 2. Check CSS and JS Bundles
// ============================================================
console.log('\n📦 Checking asset bundles...');
const astroDir = path.join(distDir, '_astro');

if (fs.existsSync(astroDir)) {
	const files = fs.readdirSync(astroDir);
	const cssFiles = files.filter((f) => f.endsWith('.css'));
	const jsFiles = files.filter((f) => f.endsWith('.js'));

	if (cssFiles.length > 0) {
		console.log(`  ✅ CSS bundles: ${cssFiles.length} file(s)`);
	} else {
		console.error(`  ❌ No CSS bundles found in _astro/`);
		hasErrors = true;
	}

	if (jsFiles.length > 0) {
		console.log(`  ✅ JS bundles: ${jsFiles.length} file(s)`);
	} else {
		console.warn(`  ⚠️ No JS bundles found (may be expected if no hydration)`);
		warnings++;
	}
} else {
	console.error(`  ❌ _astro directory not found`);
	hasErrors = true;
}

// ============================================================
// 3. Check Meta Tags in index.html
// ============================================================
console.log('\n🏷️ Checking meta tags in index.html...');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
	const indexContent = fs.readFileSync(indexPath, 'utf-8');

	// Check for title tag
	if (/<title>.+<\/title>/i.test(indexContent)) {
		console.log(`  ✅ <title> tag present`);
	} else {
		console.error(`  ❌ <title> tag missing or empty`);
		hasErrors = true;
	}

	// Check for meta description
	if (/meta\s+name=["']description["']/i.test(indexContent)) {
		console.log(`  ✅ Meta description present`);
	} else {
		console.warn(`  ⚠️ Meta description missing`);
		warnings++;
	}

	// Check for Open Graph tags
	if (/meta\s+property=["']og:/i.test(indexContent)) {
		console.log(`  ✅ Open Graph tags present`);
	} else {
		console.warn(`  ⚠️ Open Graph tags missing`);
		warnings++;
	}

	// Check for viewport meta
	if (/meta\s+name=["']viewport["']/i.test(indexContent)) {
		console.log(`  ✅ Viewport meta present`);
	} else {
		console.error(`  ❌ Viewport meta missing`);
		hasErrors = true;
	}
}

// ============================================================
// 4. Check SEO Files
// ============================================================
console.log('\n🔎 Checking SEO files...');
seoFiles.forEach((file) => {
	const filePath = path.join(distDir, file);
	if (fs.existsSync(filePath)) {
		console.log(`  ✅ Found: ${file}`);
	} else {
		console.warn(`  ⚠️ Missing: ${file}`);
		warnings++;
	}
});

// ============================================================
// Checking for optimized images (WebP)
// ============================================================
console.log('\n🖼️ Checking for optimized images...');
if (fs.existsSync(astroDir)) {
	const files = fs.readdirSync(astroDir);
	const webpFiles = files.filter((f) => f.endsWith('.webp'));
	const avifFiles = files.filter((f) => f.endsWith('.avif'));

	if (webpFiles.length > 0 || avifFiles.length > 0) {
		console.log(`  ✅ Optimized images: ${webpFiles.length} WebP, ${avifFiles.length} AVIF`);
	} else {
		console.warn(
			`  ⚠️ No WebP/AVIF images found in _astro/ (check image optimization or Vercel handling)`,
		);
		warnings++;
	}
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50));
if (hasErrors) {
	console.error(`❌ Smoke test FAILED with ${warnings} warning(s).`);
	process.exit(1);
} else if (warnings > 0) {
	console.log(`⚠️ Smoke test PASSED with ${warnings} warning(s).`);
	process.exit(0);
} else {
	console.log('✅ Smoke test PASSED.');
	process.exit(0);
}
