import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getTrackedCardsWithLmLink, updateLmPrice } from './database';
import { scrapeLigaMagic } from './scraper';

puppeteer.use(StealthPlugin());

async function main() {
    console.log('Starting LigaMagic Daily Scraper...');

    // 1. Get cards to scrape
    const cards = await getTrackedCardsWithLmLink();
    console.log(`Found ${cards.length} cards to scrape.`);

    if (cards.length === 0) {
        console.log('No cards to scrape. Exiting.');
        return;
    }

    // 2. Launch Browser
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    try {
        for (const [index, card] of cards.entries()) {
            console.log(`[${index + 1}/${cards.length}] Processing ${card.name} (${card.set_code})...`);

            try {
                // Pass set_code to scraper
                const price = await scrapeLigaMagic(browser, card.liga_magic_url, card.is_foil, card.set_code);

                if (price > 0) {
                    await updateLmPrice(card.id, card.mtgjson_uuid, price, card.liga_magic_url);
                    console.log(`Updated ${card.name}: R$ ${price}`);
                } else {
                    console.log(`Skipping update for ${card.name} (Price 0 or not found)`);
                }

            } catch (err) {
                console.error(`Failed to process ${card.name}:`, err);
            }

            // Polite delay (2-5 seconds)
            const delay = Math.floor(Math.random() * 3000) + 2000;
            // console.log(`Waiting ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    } finally {
        await browser.close();
        console.log('Scraper finished.');
    }
}

main().catch(console.error);
