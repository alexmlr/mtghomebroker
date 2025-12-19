import axios from 'axios';

export async function getCurrencyRate(): Promise<number> {
    try {
        const response = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL');
        const rate = parseFloat(response.data.USDBRL.bid);
        return rate;
    } catch (error) {
        console.error('Error fetching currency rate:', error);
        throw new Error('Failed to fetch currency rate');
    }
}

export function parseMoney(text: string): number {
    if (!text) return 0;
    // Remove '$' and ',' then parse
    return parseFloat(text.replace('$', '').replace(',', ''));
}

export function cleanText(text: string): string {
    if (!text) return '';
    return text.trim();
}

export function cleanCardName(text: string): string {
    if (!text) return '';
    let name = text.trim();
    // Remove content in parentheses at the end, e.g. "Sol Ring (KLD)" -> "Sol Ring"
    name = name.replace(/\s*\(.*?\)$/, '');
    return name.trim();
}

export function cleanSetName(text: string): string {
    if (!text) return '';
    let name = text.trim();
    // Remove content in parentheses at the end, e.g. "Promotional (S)" -> "Promotional"
    name = name.replace(/\s*\(.*?\)$/, '');
    return name.trim();
}

export function extractCollectorNumber(text: string): string {
    // Expects "Collector #: 290" or "Collector #: 0204"
    const match = text.match(/Collector #:\s*(\S+)/);
    if (match) {
        // Remove leading zeros, but keep "0" if it's just "0"
        return match[1].replace(/^0+/, '') || match[1];
    }
    return '';
}
