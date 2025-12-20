import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import { getCurrencyRate, parseMoney, cleanText, cleanCardName, cleanSetName, extractCollectorNumber } from './utils';
import { getCardId, upsertCard, updateCardPrices, insertPriceHistory } from './database';

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://www.cardkingdom.com/purchasing/mtg_singles';


export async function scrapeCard(url: string) {
    return scrape(url);
}

export async function scrapeCollection(url: string) {
    return scrape(url); // For now, logic is same: visit URL, scrape items found
}

async function scrape(url: string) {
    console.log(`Starting Scraper for URL: ${url}`);

    // 1. Get Currency Rate
    let fxRate = 5.00;
    try {
        fxRate = await getCurrencyRate();
        console.log(`Current USD-BRL Rate: ${fxRate}`);
    } catch (e) {
        console.error('Using fallback FX rate due to error.');
    }

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const results: any[] = [];

    try {
        console.log('Navigating to URL...');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Check if it's a list page by looking for the item wrapper
        // If it's a single product page, the selector might be different. 
        // For this version we assume Buylist Search Results style pages as per original script.
        try {
            await page.waitForSelector('.itemContentWrapper', { timeout: 10000 });
        } catch (e) {
            console.warn('Selector .itemContentWrapper not found. Page might be different or empty.');
            return [];
        }

        // We will process just the first page for "Card" request, or loop for "Collection"?
        // For simplicity in this v1 API, we scrape the CURRENT page content.
        // Pagination logic from original script can be re-enabled if needed, 
        // but for "paste a link", usually the user expects that page to be scraped.

        // Debug: Screenshot or check content
        console.log(`Page title: ${await page.title()}`);

        console.log(`Processing Page...`);

        const cards = await page.evaluate(() => {
            const items = document.querySelectorAll('.itemContentWrapper');
            const data: any[] = [];

            items.forEach((item) => {
                const nameEl = item.querySelector('.productDetailTitle a');
                const setEl = item.querySelector('.productDetailSet');
                const collectorEl = item.querySelector('.collectorNumber');
                const usdEl = item.querySelector('.usdSellPrice .sellDollarAmount');
                const creditEl = item.querySelector('.creditSellPrice .sellDollarAmount');
                const foilEl = item.querySelector('.foil');

                if (nameEl && setEl && collectorEl && usdEl) {
                    data.push({
                        name: nameEl.textContent?.trim(),
                        set_raw: setEl.textContent?.trim(),
                        collector_raw: collectorEl.textContent?.trim(),
                        usd_raw: usdEl.textContent?.trim(),
                        credit_raw: creditEl ? creditEl.textContent?.trim() : '0',
                        is_foil: !!foilEl
                    });
                }
            });
            return data;
        });


        console.log(`Found ${cards.length} cards.`);

        if (cards.length === 0) {
            const pageTitle = await page.title();
            console.warn(`[WARNING] No cards found on page: "${pageTitle}". This might be due to a Cloudflare block or change in page structure.`);

            const hasCloudflare = await page.evaluate(() => document.body.innerText.includes('Cloudflare') || document.body.innerText.includes('Verify you are human'));
            if (hasCloudflare) {
                console.error(`[ERROR] Cloudflare bot detection detected. Scrape failed.`);
            }
        }

        for (const card of cards) {
            let name = cleanCardName(card.name);
            let setName = cleanSetName(card.set_raw);
            const collectorNumber = extractCollectorNumber(card.collector_raw);
            const usdPrice = parseMoney(card.usd_raw);
            const creditPrice = parseMoney(card.credit_raw);
            const isFoil = card.is_foil;
            const brlPrice = (usdPrice * fxRate) + 0.30;

            // --- Scryfall Enrichment ---
            let setCode = null;
            let imageUrl = null;
            try {
                // Try to find by name (fuzzy) or set + collector number if we had set code
                // Since CK set names don't match Scryfall exactly, searching by name is safer for single card matches
                // or we could try to map set names, but that's a huge task.
                // Simplest robust way: Search exact name.
                const scryfallUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
                const sfRes = await axios.get(scryfallUrl);

                if (sfRes.data) {
                    setCode = sfRes.data.set; // e.g. "lea"
                    // Prefer normal image, fallback to others
                    imageUrl = sfRes.data.image_uris?.normal || sfRes.data.image_uris?.large || null;

                    // If we have a collector number from CK, we can verify if it matches or if we need to search more specific
                    // But for now, name match gives us the "correct" image for visual purposes
                }

                // Respect rate limits (100ms per request)
                await new Promise(r => setTimeout(r, 100));

            } catch (err: any) {
                console.warn(`Scryfall enrichment failed for ${name}:`, err.message);
            }
            // ---------------------------

            const cardData = {
                name,
                set: setName,
                set_code: setCode, // New field
                collector_number: collectorNumber,
                usd: usdPrice,
                credit: creditPrice,
                brl: brlPrice,
                foil: isFoil,
                image_url: imageUrl, // New field
                timestamp: new Date().toISOString(),
                url: url // Pass the CK URL!
            };

            // Database Sync
            try {
                // We need to update getCardId to insert if not exists, or handle insertion here
                // Since table is TRUNCATED, we likely need to INSERT new cards.
                // Updated logic: Check if exists, if not INSERT, then Update Prices.

                const cardId = await upsertCard(cardData);

                if (cardId) {
                    console.log(`Processed card: ${name} (ID: ${cardId})`);
                    await insertPriceHistory(cardId, usdPrice, 'USD', fxRate, brlPrice);

                    // Add ID to result so frontend can use it
                    results.push({ ...cardData, id: cardId });
                } else {
                    results.push(cardData);
                }
            } catch (dbErr) {
                console.error('DB Sync Error:', dbErr);
                results.push(cardData);
            }
        }

    } catch (error) {
        console.error('An error occurred during scraping:', error);
        throw error;
    } finally {
        await browser.close();
        console.log('Scraper finished.');
    }

    return results;
}

export async function scrapeLigaMagic(url: string, cardId?: number, isFoil: boolean = false) {
    console.log(`Starting LigaMagic Scraper for URL: ${url} (Foil: ${isFoil})`);

    // LigaMagic checks User-Agent heavily
    const browser = await puppeteer.launch({
        headless: true, // Keep headless for server mode, use false for debug if needed
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    let priceBrl = 0;

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for the price container
        try {
            await page.waitForSelector('#container-price-mkp-card', { timeout: 15000 });
        } catch (e) {
            console.warn('LigaMagic: Price container #container-price-mkp-card not found.');
        }

        // Logic refined by user:
        // Container: <div class="container-price-mkp-item" id="container-price-mkp-card">
        // Inside: Two <div class="bg-light-gray container-price-mkp"> (1st = Non-Foil, 2nd = Foil)
        // Inside that: <div class="min"><div class="price">R$ XX,XX</div></div>

        priceBrl = await page.evaluate((isFoil) => {
            const container = document.querySelector('#container-price-mkp-card');
            if (!container) return 0;

            const priceBlocks = container.querySelectorAll('.bg-light-gray.container-price-mkp');

            // Index 0 is Non-Foil, Index 1 is Foil (if available)
            let blockIndex = isFoil ? 1 : 0;

            // Safety check: if only 1 block exists (e.g. only normal exists, or only foil exists?)
            // Usually LM shows placeholders if empty, but let's be safe.
            // If we want Foil but only 1 block exists, we might need to check if the block says "Foil" or assume position.
            // But based on user description: "ha duas divs... sendo a primeira normal e a segunda foil".
            // We will trust strictly on index for now, but gracefully handle bounds.

            if (blockIndex >= priceBlocks.length) {
                // Return 0 if the specific version block doesn't exist
                return 0;
            }

            const targetBlock = priceBlocks[blockIndex];

            // Find Min Price
            const minPriceEl = targetBlock.querySelector('.min .price');
            if (minPriceEl) {
                const text = minPriceEl.textContent?.trim() || '';
                // Clean "R$ " and convert
                // Example: "R$ 81,00" -> "81.00"
                const clean = text.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.');
                return parseFloat(clean) || 0;
            }

            return 0;
        }, isFoil);

        console.log(`LigaMagic: Extracted Price R$ ${priceBrl}`);

        // 4. Update Database
        if (cardId && priceBrl > 0) {
            // We need to import checkAndUpdateLigaMagic or similar
            // For now, we call the database function directly if we imported it
            const { updateLigaMagicPrice } = require('./database'); // Dynamic import to avoid circular dependency issues if any
            await updateLigaMagicPrice(cardId, priceBrl, url);
            console.log(`LigaMagic: Database updated for Card ID ${cardId}`);
        }

    } catch (error) {
        console.error('LigaMagic Scrape Error:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return { price_brl: priceBrl };
}

