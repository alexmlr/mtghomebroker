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

export function parseBrlMoney(text: string): number {
    if (!text) return 0;
    // Example: "R$ 1.234,56" -> 1234.56
    // Remove "R$", spaces, replace dots generally (thousands), replace comma with dot
    // However, JS replaceAll or regex is needed.
    // "1.234,56" -> remove dots -> "1234,56" -> replace comma -> "1234.56"

    // Remove non-numeric except comma and dot (if any left, but we want to strip thousands separator)
    // Safest: Remove "R$", trim.
    let clean = text.replace('R$', '').trim();
    // Remove thousand separators (.)
    clean = clean.replace(/\./g, '');
    // Replace decimal separator (,) with (.)
    clean = clean.replace(',', '.');

    return parseFloat(clean);
}
