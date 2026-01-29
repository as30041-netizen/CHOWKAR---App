
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log('🎥 Debug Recording: Employer Guide (EN)');
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        recordVideo: {
            dir: path.join(process.cwd(), 'debug_recordings'),
            size: { width: 375, height: 667 }
        }
    });

    const page = await context.newPage();

    try {
        await page.addInitScript(() => {
            localStorage.setItem('chowkar_mock_auth', 'true');
            localStorage.setItem('chowkar_language', 'en');
        });

        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        console.log('   Values set. Waiting for load...');
        await page.waitForTimeout(3000);

        console.log('   Clicking "Post a Job"...');
        const postBtn = page.locator('button.bg-emerald-600').first();
        await postBtn.click({ timeout: 5000, force: true });

        console.log('   Waiting for Category selection...');
        await page.waitForTimeout(2000);

        await page.locator('div[role="button"]').nth(1).click({ force: true });

        console.log('   Waiting for form...');
        await page.waitForTimeout(3000);

        console.log('   ✅ Flow complete.');
    } catch (e) {
        console.error('   ❌ Failed:', e);
    } finally {
        await context.close();
        await browser.close();

        const dir = path.join(process.cwd(), 'debug_recordings');
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const vid = files.find(f => f.endsWith('.webm'));
            if (vid) {
                const dest = path.join(process.cwd(), 'public', 'assets', 'videos', 'employer_guide_en.webm');
                fs.copyFileSync(path.join(dir, vid), dest);
                console.log(`   Saved to: ${dest}`);
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }
    }
})();
