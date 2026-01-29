
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log('🎥 Debug Recording: Employer Guide (EN) - STATE CHECK');
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2
    });

    const page = await context.newPage();

    try {
        console.log('   Setting Mock Auth...');
        await page.addInitScript(() => {
            localStorage.setItem('chowkar_mock_auth', 'true');
            localStorage.setItem('chowkar_language', '"en"');
            localStorage.setItem('chowkar_role', '"POSTER"');
        });

        console.log('   Navigating to Home...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        console.log(`   [HOME] Current URL: ${page.url()}`);
        console.log(`   [HOME] Body Text: ${(await page.innerText('body')).substring(0, 100).replace(/\n/g, ' ')}...`);

        // Check for specific Dashboard elements
        const postBtn = page.locator('button', { hasText: 'Post Job' }).or(page.locator('button:has-text("POST JOB")'));
        const count = await postBtn.count();
        console.log(`   [HOME] "Post Job" buttons found: ${count}`);

        if (count > 0) {
            console.log('   [Action] Clicking Post Job...');
            await postBtn.first().click({ force: true });
        } else {
            console.log('   [Action] Force navigating to /post...');
            await page.goto('http://localhost:3000/post');
        }

        await page.waitForTimeout(2000);
        console.log(`   [POST] Current URL: ${page.url()}`);
        console.log(`   [POST] Body Text: ${(await page.innerText('body')).substring(0, 100).replace(/\n/g, ' ')}...`);

        // Check for input
        const inputCount = await page.locator('input[type="text"]').count();
        console.log(`   [POST] Inputs found: ${inputCount}`);

    } catch (e) {
        console.error('   ❌ Failed:', e);
    } finally {
        await context.close();
        await browser.close();
    }
})();
