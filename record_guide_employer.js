
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log('Starting Employer Guide Recording...');
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone SE
        deviceScaleFactor: 2,
        recordVideo: {
            dir: path.join(process.cwd(), 'recordings_emp'),
            size: { width: 375, height: 667 }
        }
    });
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

        // 1. Initial view
        await page.waitForTimeout(1000);

        // 2. Highlight "Post a Job"
        const postBtn = page.getByRole('button', { name: /Post a Job/i }).first();
        await postBtn.hover(); // visual feedback if supported
        await page.waitForTimeout(500);

        // 3. Click it
        await postBtn.click();

        // 4. Wait for Modal (it's the Auth modal since we aren't logged in)
        // We'll just wait a bit to show the modal appeared
        await page.waitForTimeout(2000);

        console.log('Employer Guide Recording Complete');

    } catch (error) {
        console.error('Error recording Employer Guide:', error);
    } finally {
        await context.close();
        await browser.close();

        const recordingDir = path.join(process.cwd(), 'recordings_emp');
        if (fs.existsSync(recordingDir)) {
            const files = fs.readdirSync(recordingDir);
            const videoFile = files.find(f => f.endsWith('.webm'));
            if (videoFile) {
                const finalPath = path.join(process.cwd(), 'employer_guide.webm');
                fs.copyFileSync(path.join(recordingDir, videoFile), finalPath);
                fs.rmSync(recordingDir, { recursive: true, force: true });
                console.log(`Saved: ${finalPath}`);
            }
        }
    }
})();
