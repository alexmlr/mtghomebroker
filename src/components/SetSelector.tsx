import React, { useState } from 'react';
import { getScryfallImageUrl } from '../lib/scryfall';

interface CardPrint {
    id: number;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_url: string | null;
    name: string;
}

interface SetSelectorProps {
    prints: CardPrint[];
    currentCardId: number;
    onHover: (imageUrl: string | null) => void;
    onLeave: () => void;
    onSelect: (cardId: number) => void;
}

const SetIcon: React.FC<{ print: CardPrint; isSelected: boolean }> = ({ print, isSelected }) => {
    const [error, setError] = useState(false);

    if (error) {
        return (
            <span className={`
                text-[9px] font-bold uppercase tracking-tighter
                ${isSelected ? 'text-blue-300' : 'text-gray-500 group-hover:text-white'}
            `}>
                {print.set_code}
            </span>
        );
    }

    // Use theme-aware conditional logic if Tailwind dark: modifier is being stubborn in this context
    // But dark:invert SHOULD work if 'dark' class is on HTML.
    // Let's add !important via inline style or custom class if needed, or check if 'grayscale' conflicts.
    // 'grayscale' and 'invert' can coexist.
    // Trying a more explicit approach for dark mode visibility.
    return (
        <img
            src={`https://svgs.scryfall.io/sets/${print.set_code}.svg`}
            alt={print.set_name}
            className={`
                w-5 h-5 object-contain 
                ${isSelected ? 'brightness-125 drop-shadow-md' : 'grayscale group-hover:grayscale-0'}
                set-icon-dark
                transition-all duration-300
            `}
            onError={() => setError(true)}
        />
    );
};


export const SetSelector: React.FC<SetSelectorProps> = ({
    prints,
    currentCardId,
    onHover,
    onLeave,
    onSelect
}) => {
    return (
        <div className="flex flex-col gap-2 py-2 pr-2 overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {prints.map((print) => {
                const isSelected = print.id === currentCardId;

                return (
                    <div
                        key={print.id}
                        className={`
                            relative group cursor-pointer transition-all duration-200
                            flex items-center justify-center p-1.5 rounded-lg w-8 h-8
                            ${isSelected
                                ? 'bg-blue-600/20 border-l-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                : 'hover:bg-gray-800/50 hover:border-l-2 hover:border-gray-500 opacity-60 hover:opacity-100'
                            }
                        `}
                        onMouseEnter={async () => {
                            let url: string | null = print.image_url;
                            if (!url) {
                                url = await getScryfallImageUrl(print.set_code, print.collector_number);
                            }
                            onHover(url);
                        }}
                        onMouseLeave={onLeave}
                        onClick={() => onSelect(print.id)}
                        title={`${print.set_name} #${print.collector_number}`}
                    >
                        <SetIcon print={print} isSelected={isSelected} />
                    </div>
                );
            })}
        </div>
    );
};
