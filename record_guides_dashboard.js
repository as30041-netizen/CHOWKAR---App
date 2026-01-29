
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURATION
const LANGUAGES = ['en', 'hi', 'pa'];
const ROLES = ['EMPLOYER', 'WORKER'];
const VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'assets', 'videos');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
    console.log('🎬 Starting Dashboard Video Guide Recording (FIXED)...');

    for (const lang of LANGUAGES) {
        for (const role of ROLES) {
            console.log(`\n🎥 Recording: [${role}] [${lang}]`);

            const browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const context = await browser.newContext({
                viewport: VIEWPORT,
                deviceScaleFactor: 2,
                recordVideo: {
                    dir: path.join(process.cwd(), 'temp_recordings'),
                    size: VIEWPORT
                },
                locale: lang === 'hi' ? 'hi-IN' : (lang === 'pa' ? 'pa-IN' : 'en-US')
            });

            const page = await context.newPage();

            try {
                // 1. SETUP MOCK AUTH & LANGUAGE
                await page.addInitScript((data) => {
                    localStorage.setItem('chowkar_mock_auth', 'true');
                    localStorage.setItem('chowkar_language', JSON.stringify(data.lang));

                    // Force role based on what we are recording
                    const mockUser = {
                        id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
                        name: 'Demo User',
                        phone: '9876543210',
                        location: 'Mumbai, India',
                        role: data.role === 'EMPLOYER' ? 'POSTER' : 'WORKER',
                        isPremium: true,
                        aiUsageCount: 0
                    };
                    localStorage.setItem('chowkar_user', JSON.stringify(mockUser));
                    localStorage.setItem('chowkar_role', JSON.stringify(data.role === 'EMPLOYER' ? 'POSTER' : 'WORKER'));
                    localStorage.setItem('chowkar_isLoggedIn', 'true'); // Explicitly set this too
                }, { lang, role });

                // 2. NAVIGATE & WAIT FOR DASHBOARD
                // Use networkidle (safer for SPA)
                await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
                await page.waitForTimeout(3000); // Allow hydration

                // 3. EXECUTE FLOW
                if (role === 'EMPLOYER') {
                    // --- EMPLOYER FLOW: POST A JOB ---
                    console.log('   [Action] Navigating to Post Job...');

                    // Click "Post Job" (checking mobile bottom nav or header)
                    // Mobile Bottom Nav usually has "Post" or Header has "+"
                    // Let's use direct navigation or look for the button
                    // Try finding the "Post Job" text or icon
                    try {
                        // Header button (Mobile or Desktop)
                        const postBtn = page.locator('button', { hasText: 'Post Job' })
                            .or(page.locator('button', { hasText: 'नया काम' }))
                            .or(page.locator('button', { hasText: 'Naya Kaam' }))
                            .or(page.locator('button').locator('svg.lucide-plus'));

                        if (await postBtn.count() > 0 && await postBtn.first().isVisible()) {
                            console.log('   [Action] Clicking Dashboard CTA...');
                            await postBtn.first().click({ force: true });
                        } else {
                            console.log('   [Action] CTA not found, force navigating to /post...');
                            await page.goto('http://localhost:3000/post');
                        }
                    } catch (err) {
                        await page.goto('http://localhost:3000/post');
                    }

                    await page.waitForTimeout(2000);

                    // Form Interaction
                    console.log('   [Action] Filling Form...');

                    try {
                        await page.waitForSelector('input[type="text"]', { state: 'visible', timeout: 10000 });
                        // Title
                        await page.locator('input[type="text"]').first().focus();
                        await page.keyboard.type(lang === 'en' ? 'House Cleaning' : (lang === 'hi' ? 'घर की सफाई' : 'ਘਰ ਦੀ ਸਫਾਈ'), { delay: 100 });
                        await page.waitForTimeout(1000);

                        // Category (Select first grid item)
                        await page.locator('.grid button').first().click({ force: true });
                        await page.waitForTimeout(1000);

                        // Description
                        await page.locator('textarea').focus();
                        await page.keyboard.type('Need cleaning for 2BHK.', { delay: 50 });
                        await page.waitForTimeout(1000);

                        // Scroll down
                        await page.evaluate(() => window.scrollBy(0, 300));
                        await page.waitForTimeout(1000);
                    } catch (e) {
                        console.log('   [Error] Form input not found, likely navigation failed.');
                    }

                } else {
                    // --- WORKER FLOW: FIND WORK ---
                    console.log('   [Action] Browsing Jobs...');

                    // Ensure we are on Find page
                    if (!page.url().includes('/find') && !page.url().endsWith('/')) {
                        await page.goto('http://localhost:3000/find');
                    }

                    // Click first job card
                    const jobCard = page.locator('.bg-surface').locator('h3').first();
                    // Wait for list to load
                    try {
                        await jobCard.waitFor({ state: 'visible', timeout: 10000 });
                        console.log('   [Action] Clicking Job Card...');
                        await jobCard.click({ force: true });

                        // Wait for Modal
                        await page.waitForTimeout(2000);

                        // Scroll inside modal
                        await page.evaluate(() => {
                            const modal = document.querySelector('[role="dialog"]');
                            if (modal) modal.scrollBy(0, 200);
                        });
                        await page.waitForTimeout(1500);

                    } catch (e) {
                        console.log('   [Warn] No job cards found or timeout.');
                    }
                }

                // 4. WAIT FOR COMPILATION
                await page.waitForTimeout(2000);
                console.log('   ✅ Recording Complete.');

            } catch (err) {
                console.error(`   ❌ Failed: ${err.message}`);
            } finally {
                await context.close();
                await browser.close();

                // MOVE VIDEO
                const tempDir = path.join(process.cwd(), 'temp_recordings');
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    const vid = files.find(f => f.endsWith('.webm'));
                    if (vid) {
                        const filename = role === 'EMPLOYER'
                            ? `employer_guide_${lang}.webm`
                            : `worker_guide_${lang}.webm`;

                        const src = path.join(tempDir, vid);
                        const dest = path.join(OUTPUT_DIR, filename);

                        // Rename/Move
                        fs.copyFileSync(src, dest);
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        console.log(`   💾 Saved to: ${filename}`);
                    }
                }
            }
        }
    }
})();
