
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to ensure directory exists
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

(async () => {
    const browser = await chromium.launch(); // Headless default is fine for recording
    const languages = [
        { code: 'en', label: 'English' },
        { code: 'hi', label: 'Hindi' },
        { code: 'pa', label: 'Punjabi' }
    ];

    // Output directory
    const outputDir = path.join(process.cwd(), 'public', 'assets', 'videos');
    ensureDir(outputDir);

    for (const lang of languages) {
        console.log(`\n🎥 Starting recording for: ${lang.label} (${lang.code})`);

        // --- CONTEXT SETUP ---
        const context = await browser.newContext({
            viewport: { width: 375, height: 667 }, // iPhone SE
            deviceScaleFactor: 2,
            recordVideo: {
                dir: path.join(process.cwd(), 'temp_recordings'),
                size: { width: 375, height: 667 }
            }
        });

        // --- EMPLOYER GUIDE ---
        console.log(`   [Employer] Recording...`);
        let page = await context.newPage();

        try {
            // 1. Init with Mock Auth & Language
            await page.addInitScript((code) => {
                localStorage.setItem('chowkar_mock_auth', 'true');
                localStorage.setItem('chowkar_language', JSON.stringify(code));
            }, lang.code);

            await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000); // Wait for hydration

            // 2. Start "Post Job" Flow
            // Click "Post a Job" (First big CTA)
            const postBtn = page.locator('button.bg-emerald-600').first();
            await postBtn.click();
            await page.waitForTimeout(1500); // Wait for Category Modal

            // 3. Select "Maid" or "Driver" (Second item usually)
            // We use generic selector to be robust across languages
            await page.locator('div[role="button"]').nth(2).click();
            await page.waitForTimeout(1000);

            // 4. Job Form Interaction (Mock typing)
            const jobTitleInput = page.getByPlaceholder(/Title|job|kam/i).first();
            if (await jobTitleInput.isVisible()) {
                await jobTitleInput.fill('Need a helper for 2 days');
                await page.waitForTimeout(500);
            }

            await page.waitForTimeout(2000); // Show the form a bit
            // Close page to save video
            await page.close();

            // RENAME ARTIFACT
            const tempFiles = fs.readdirSync(path.join(process.cwd(), 'temp_recordings'));
            const vidFile = tempFiles.find(f => f.endsWith('.webm'));
            if (vidFile) {
                const newName = `employer_guide_${lang.code}.webm`;
                fs.copyFileSync(
                    path.join(process.cwd(), 'temp_recordings', vidFile),
                    path.join(outputDir, newName)
                );
                console.log(`   ✅ Saved: ${newName}`);
                // Cleanup temp dir for next run
                fs.rmSync(path.join(process.cwd(), 'temp_recordings'), { recursive: true, force: true });
                ensureDir(path.join(process.cwd(), 'temp_recordings')); // Recreate for next
            }

        } catch (e) {
            console.error(`   ❌ Error [Employer ${lang.code}]:`, e);
        }

        // --- WORKER GUIDE ---
        console.log(`   [Worker] Recording...`);
        // New page for clean slate (fresh video file)
        page = await context.newPage();

        try {
            // 1. Init with Mock Auth & Language
            await page.addInitScript((code) => {
                localStorage.setItem('chowkar_mock_auth', 'true');
                localStorage.setItem('chowkar_language', JSON.stringify(code));
            }, lang.code);

            await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);

            // 2. Start "Find Work" Flow
            // Click "Find Work" (Second big CTA)
            const findBtn = page.locator('button.bg-transparent').first();
            await findBtn.click();
            await page.waitForTimeout(1500); // Wait for Job List

            // 3. Scroll a bit to show jobs
            await page.mouse.wheel(0, 300);
            await page.waitForTimeout(1000);

            // 4. Click first Job Card
            await page.locator('div.bg-card').first().click();
            await page.waitForTimeout(1500); // Wait for Details Modal

            // 5. Highlight "Call Now"
            const callBtn = page.locator('button.bg-emerald-600').last(); // Usually Call/Apply is distinct
            if (await callBtn.isVisible()) {
                await callBtn.hover();
                await page.waitForTimeout(1000);
            }

            await page.waitForTimeout(1000);
            await page.close();

            // RENAME ARTIFACT
            const tempFiles = fs.readdirSync(path.join(process.cwd(), 'temp_recordings'));
            const vidFile = tempFiles.find(f => f.endsWith('.webm'));
            if (vidFile) {
                const newName = `worker_guide_${lang.code}.webm`;
                fs.copyFileSync(
                    path.join(process.cwd(), 'temp_recordings', vidFile),
                    path.join(outputDir, newName)
                );
                console.log(`   ✅ Saved: ${newName}`);
                fs.rmSync(path.join(process.cwd(), 'temp_recordings'), { recursive: true, force: true });
                ensureDir(path.join(process.cwd(), 'temp_recordings'));
            }

        } catch (e) {
            console.error(`   ❌ Error [Worker ${lang.code}]:`, e);
        }

        await context.close();
    }

    await browser.close();
    console.log('\n✨ All recordings complete.');
})();
