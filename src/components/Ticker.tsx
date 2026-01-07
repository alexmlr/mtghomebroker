import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TickerItem {
    id: number;
    name: string;
    priceUsd: number;
    percentChange: number;
    isFoil?: boolean;
}

interface TickerProps {
    items: TickerItem[];
}

export const Ticker: React.FC<TickerProps> = ({ items }) => {
    // Determine color based on percentage
    const getColor = (pct: number) => {
        if (pct > 0) return 'text-green-500';
        if (pct < 0) return 'text-red-500';
        return 'text-gray-400';
    };

    const getIcon = (pct: number) => {
        if (pct > 0) return <TrendingUp size={10} className="mr-0.5" />;
        if (pct < 0) return <TrendingDown size={10} className="mr-0.5" />;
        return <Minus size={10} className="mr-0.5" />;
    };

    // We duplicate items to create a seamless loop
    // If items are few, we might need to duplicate multiple times to fill the screen
    const displayItems = [...items, ...items, ...items, ...items];

    return (
        <div className="ticker-wrap w-full border-b border-gray-700">
            <div className="ticker-label">
                CARDKINGDOM:
            </div>
            <div className="ticker-content pl-24"> {/* pl-24 to offset the absolute label initially if needed, or just let it scroll behind */}
                {displayItems.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="ticker-item">
                        <span className="mr-1 font-semibold">{item.name}</span>
                        <span className="font-mono opacity-75 mr-1">${item.priceUsd.toFixed(2)}</span>
                        <span className={`flex items-center font-bold ${getColor(item.percentChange)}`}>
                            {getIcon(item.percentChange)}
                            {item.percentChange > 0 ? '+' : ''}{item.percentChange.toFixed(2)}%
                        </span>
                        {item.isFoil && (
                            <span className="ml-1 text-[8px] bg-amber-500/20 text-amber-500 px-0.5 rounded">F</span>
                        )}
                        <span className="opacity-30 mx-2">•</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
