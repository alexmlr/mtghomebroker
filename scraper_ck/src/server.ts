import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeCard, scrapeCollection } from './scraper';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'CardKingdom Scraper' });
});

// Scrape Single Card
app.post('/scrape/card', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        console.log(`Received request to scrape card: ${url}`);
        const result = await scrapeCard(url);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error scraping card:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Scrape Collection
app.post('/scrape/collection', async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        console.log(`Received request to scrape collection: ${url}`);
        const result = await scrapeCollection(url);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error scraping collection:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Scrape LigaMagic
app.post('/scrape/ligamagic', async (req: Request, res: Response): Promise<void> => {
    const { url, cardId, isFoil } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        const { scrapeLigaMagic } = require('./scraper'); // Lazy import
        console.log(`Received request to scrape LigaMagic: ${url} (CardID: ${cardId}, Foil: ${isFoil})`);
        const result = await scrapeLigaMagic(url, cardId, isFoil);
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error scraping LigaMagic:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
