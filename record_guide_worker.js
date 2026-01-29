
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    console.log('Starting Worker Guide Recording...');
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone SE
        deviceScaleFactor: 2,
        recordVideo: {
            dir: path.join(process.cwd(), 'recordings_work'),
            size: { width: 375, height: 667 }
        }
    });
    const page = await context.newPage();

    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

        // 1. Initial view
        await page.waitForTimeout(1000);

        // 2. Find "Find Work" button
        const findBtn = page.getByRole('button', { name: /Find Work/i }).first();
        await findBtn.hover();
        await page.waitForTimeout(500);

        // 3. Click it
        await findBtn.click();

        // 4. Wait for Modal
        await page.waitForTimeout(2000);

        console.log('Worker Guide Recording Complete');

    } catch (error) {
        console.error('Error recording Worker Guide:', error);
    } finally {
        await context.close();
        await browser.close();

        const recordingDir = path.join(process.cwd(), 'recordings_work');
        if (fs.existsSync(recordingDir)) {
            const files = fs.readdirSync(recordingDir);
            const videoFile = files.find(f => f.endsWith('.webm'));
            if (videoFile) {
                const finalPath = path.join(process.cwd(), 'worker_guide.webm');
                fs.copyFileSync(path.join(recordingDir, videoFile), finalPath);
                fs.rmSync(recordingDir, { recursive: true, force: true });
                console.log(`Saved: ${finalPath}`);
            }
        }
    }
})();
