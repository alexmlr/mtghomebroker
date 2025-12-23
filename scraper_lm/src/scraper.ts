import { Browser } from 'puppeteer';
import { parseBrlMoney } from './utils';

export async function scrapeLigaMagic(browser: Browser, url: string, isFoil: boolean = false, setCode?: string): Promise<number> {
    const page = await browser.newPage();
    let priceBrl: string | null = null;

    try {
        // Set User Agent to avoid detection (Puppeteer Stealth handles this, but explicit setting is good practice)
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url} (Foil: ${isFoil}, Set: ${setCode || 'Any'})...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for price container
        try {
            await page.waitForSelector('#container-price-mkp-card', { timeout: 15000 });
        } catch (e) {
            console.warn(`LigaMagic: Price container not found for ${url}`);
            return 0;
        }

        // --- Smart Edition Selection ---
        if (setCode) {
            console.log(`Searching for edition icon with code: ${setCode}`);

            const iconClicked = await page.evaluate((code) => {
                const slider = document.querySelector('#slider-editions-icons');
                if (!slider) return false;

                // Find image containing the set code in src or data-src
                // Typically: .../ed_mtg/RNA_R.gif
                // We normalize code to uppercase just in case
                const targetCode = code.toUpperCase();
                const images = Array.from(slider.querySelectorAll('img'));

                const targetImg = images.find(img => {
                    const src = (img.getAttribute('src') || '').toUpperCase();
                    const dataSrc = (img.getAttribute('data-src') || '').toUpperCase();
                    // Check if code is enclosed like /CODE_ or /CODE. or just CODE safely?
                    // User example: .../RNA_R.gif. So "RNA" matches.
                    return src.includes(targetCode) || dataSrc.includes(targetCode);
                });

                if (targetImg) {
                    // Click parent anchor if exists, otherwise click img
                    const parentLink = targetImg.closest('a');
                    if (parentLink) {
                        parentLink.click();
                        return true;
                    }
                    targetImg.click();
                    return true;
                }
                return false;
            }, setCode);

            if (iconClicked) {
                console.log('Edition icon found and clicked. Waiting for price update...');
                // Wait a bit for JS to update DOM
                await new Promise(r => setTimeout(r, 1500));
            } else {
                console.warn(`Warning: Edition icon for ${setCode} not found. Using default.`);
            }
        }
        // -------------------------------

        priceBrl = await page.evaluate((isFoil) => {
            const container = document.querySelector('#container-price-mkp-card');
            if (!container) return null;

            const priceBlocks = container.querySelectorAll('.bg-light-gray.container-price-mkp');

            // Index 0: Normal, Index 1: Foil
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
