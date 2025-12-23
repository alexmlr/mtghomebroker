import { Browser } from 'puppeteer';
import { parseBrlMoney } from './utils';

export async function scrapeLigaMagic(browser: Browser, url: string, isFoil: boolean = false): Promise<number> {
    const page = await browser.newPage();
    let priceBrl: string | null = null;

    try {
        // Set User Agent to avoid detection (Puppeteer Stealth handles this, but explicit setting is good practice)
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url} (Foil: ${isFoil})...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for price container
        try {
            await page.waitForSelector('#container-price-mkp-card', { timeout: 15000 });
        } catch (e) {
            console.warn(`LigaMagic: Price container not found for ${url}`);
            return 0;
        }

        priceBrl = await page.evaluate((isFoil) => {
            const container = document.querySelector('#container-price-mkp-card');
            if (!container) return null;

            const priceBlocks = container.querySelectorAll('.bg-light-gray.container-price-mkp');

            // Index 0: Normal, Index 1: Foil
            // Strategy: 
            // If isFoil is true, we look for appropriate block.
            // Use simple index logic as verified in scraper_ck.
            let blockIndex = isFoil ? 1 : 0;

            if (blockIndex >= priceBlocks.length) {
                // If we want foil but it doesn't exist at index 1
                return null;
            }

            const targetBlock = priceBlocks[blockIndex];
            const minPriceEl = targetBlock.querySelector('.min .price');

            if (minPriceEl && minPriceEl.textContent) {
                return minPriceEl.textContent.trim();
            }
            return null;
        }, isFoil);

        if (priceBrl) {
            const val = parseBrlMoney(priceBrl);
            console.log(`Found Price: R$ ${val}`);
            return val;
        }

    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return 0;
    } finally {
        await page.close();
    }
    return 0;
}
