import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { SearchableSelect, type Option } from './SearchableSelect';

interface LigaMagicModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardId: number | null;
    currentUrl?: string | null;
    onSuccess: () => void;
}

export const LigaMagicModal: React.FC<LigaMagicModalProps> = ({ isOpen, onClose, cardId, currentUrl, onSuccess }) => {
    const [url, setUrl] = useState(currentUrl || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Set Selection State
    const [sets, setSets] = useState<Option[]>([]);
    const [selectedSetCode, setSelectedSetCode] = useState<string>('');
    const [loadingSets, setLoadingSets] = useState(false);

    // Update url state when currentUrl prop changes
    useEffect(() => {
        setUrl(currentUrl || '');
    }, [currentUrl]);

    // Fetch Sets and Current Card's Set Code when modal opens
    useEffect(() => {
        if (isOpen && cardId) {
            fetchSetsAndCardDetails();
        }
    }, [isOpen, cardId]);

    const fetchSetsAndCardDetails = async () => {
        setLoadingSets(true);
        try {
            // 1. Fetch all available sets
            const { data: setsData, error: setsError } = await supabase
                .from('sets')
                .select('code, name')
                .order('name', { ascending: true }); // ordering by name is user friendly

            if (!setsError && setsData) {
                const options: Option[] = setsData.map(s => ({
                    value: s.code,
                    label: s.name,
                    subLabel: s.code
                }));
                setSets(options);
            }

            // 2. Fetch current card's set_code (from all_cards to be safe)
            const { data: cardData, error: cardError } = await supabase
                .from('all_cards')
                .select('set_code')
                .eq('id', cardId)
                .single();

            if (!cardError && cardData) {
                setSelectedSetCode(cardData.set_code);
            }

        } catch (err) {
            console.error('Error fetching sets:', err);
        } finally {
            setLoadingSets(false);
        }
    };

    if (!isOpen || !cardId) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validation: Ensure it looks like a LigaMagic URL (basic check)
            if (url && !url.includes('ligamagic.com')) {
                throw new Error('A URL deve ser do site LigaMagic.');
            }

            // Update URL and Set Code
            const { error: updateError } = await supabase
                .from('all_cards')
                .update({
                    liga_magic_url: url,
                    set_code: selectedSetCode
                })
                .eq('id', cardId);

            if (updateError) throw updateError;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error saving LigaMagic URL:', err);
            setError(err.message || 'Erro ao salvar URL.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-visible transform transition-all border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-purple-600">⚡</span> Vincular LigaMagic
                    </h3>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                        Defina o link e a coleção exata para garantirmos o preço correto.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Link Field */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Link da Carta
                        </label>
                        <div className="relative">
                            <input
                                type="url"
                                placeholder="https://www.ligamagic.com.br/..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all bg-white text-gray-900 placeholder-gray-400"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={loading}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Set Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Coleção (Edição)
                        </label>
                        {loadingSets ? (
                            <div className="h-11 w-full bg-gray-100 animate-pulse rounded-lg"></div>
                        ) : (
                            <SearchableSelect
                                options={sets}
                                value={selectedSetCode}
                                onChange={setSelectedSetCode}
                                placeholder="Selecione a coleção..."
                                disabled={loading}
                            />
                        )}
                        <p className="text-[11px] text-gray-400 mt-1.5">
                            Selecione a coleção correspondente ao link para scraper ser preciso.
                        </p>
                    </div>

                    {error && (
                        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all shadow-md hover:shadow-lg disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
