import React from 'react';
import { Plus } from 'lucide-react';

interface TrackButtonProps {
    isTracked: boolean;
    onToggle: (e: React.MouseEvent) => void;
    type: 'card' | 'set';
    className?: string;
}

export const TrackButton: React.FC<TrackButtonProps> = ({ isTracked, onToggle, type, className = '' }) => {
    return (
        <button
            onClick={onToggle}
            className={`
                inline-flex items-center justify-center rounded-md transition-all duration-200 border shadow-sm
                ${isTracked
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-red-500 hover:border-red-500 opacity-100'
                    : type === 'set'
                        ? 'bg-white text-gray-400 border-gray-200 hover:border-blue-400 hover:text-blue-400 opacity-100'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-blue-400 hover:text-blue-400 opacity-0 group-hover:opacity-100'
                }
                ${className}
            `}
            title={isTracked ? "Deixar de acompanhar" : "Acompanhar"}
            style={{
                width: '24px',
                height: '24px',
                marginLeft: '8px',
            }}
        >
            <Plus
                size={14}
                style={{
                    transform: isTracked ? 'rotate(45deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                }}
            />
        </button>
    );
};
