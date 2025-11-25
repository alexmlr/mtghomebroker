import React, { useState, useRef } from 'react';
import { getScryfallImageUrl } from '../lib/scryfall';
import { Loader2, ImageOff } from 'lucide-react';

interface CardPreviewProps {
    set_code: string;
    collector_number: string;
    children: React.ReactNode;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ set_code, collector_number, children }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [fetched, setFetched] = useState(false);

    // Position state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = async (e: React.MouseEvent) => {
        setIsHovering(true);
        updatePosition(e);

        if (!fetched && !loading && !imageUrl) {
            setLoading(true);
            const url = await getScryfallImageUrl(set_code, collector_number);
            if (url) {
                setImageUrl(url);
            } else {
                setError(true);
            }
            setLoading(false);
            setFetched(true);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        updatePosition(e);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
    };

    const updatePosition = (e: React.MouseEvent) => {
        // Offset the image slightly from the cursor
        const xOffset = 20;
        const yOffset = 20;

        // Check window boundaries to prevent overflow (simple check)
        let x = e.clientX + xOffset;
        let y = e.clientY + yOffset;

        // If too close to right edge, move to left
        if (x + 250 > window.innerWidth) {
            x = e.clientX - 270;
        }

        // If too close to bottom edge, move up
        if (y + 350 > window.innerHeight) {
            y = e.clientY - 350;
        }

        setPosition({ x, y });
    };

    return (
        <div
            ref={triggerRef}
            className="inline-block cursor-help relative"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isHovering && (
                <div
                    style={{
                        position: 'fixed',
                        top: position.y,
                        left: position.x,
                        zIndex: 9999,
                        width: '240px',
                        height: 'auto',
                        minHeight: '340px',
                        backgroundColor: '#1e1e1e',
                        borderRadius: '14px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none' // Important so it doesn't flicker on mouse over
                    }}
                >
                    {loading ? (
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Loader2 className="animate-spin" size={32} />
                            <span className="text-xs">Carregando imagem...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-2 text-gray-500 p-4 text-center">
                            <ImageOff size={32} />
                            <span className="text-xs">Imagem não encontrada</span>
                        </div>
                    ) : (
                        <img
                            src={imageUrl!}
                            alt="Card Preview"
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};
