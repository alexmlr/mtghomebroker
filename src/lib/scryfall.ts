
interface ScryfallCard {
    image_uris?: {
        normal: string;
        small: string;
        large: string;
        png: string;
    };
    card_faces?: Array<{
        image_uris?: {
            normal: string;
            small: string;
            large: string;
            png: string;
        };
    }>;
}

/**
 * Fetches the card image URL from Scryfall API.
 * Uses the format: https://api.scryfall.com/cards/<set_code>/<collector_number>
 */
export const getScryfallImageUrl = async (set_code: string, collector_number: string): Promise<string | null> => {
    if (!set_code || !collector_number) return null;

    try {
        const url = `https://api.scryfall.com/cards/${set_code.toLowerCase()}/${collector_number}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Card not found on Scryfall: ${set_code}/${collector_number}`);
                return null;
            }
            throw new Error(`Scryfall API error: ${response.statusText}`);
        }

        const data: ScryfallCard = await response.json();

        // Handle normal cards
        if (data.image_uris?.normal) {
            return data.image_uris.normal;
        }

        // Handle Double-Faced Cards (images are inside card_faces)
        if (data.card_faces && data.card_faces.length > 0 && data.card_faces[0].image_uris?.normal) {
            return data.card_faces[0].image_uris.normal;
        }

        return null;

    } catch (error) {
        console.error('Error fetching Scryfall image:', error);
        return null;
    }
};
