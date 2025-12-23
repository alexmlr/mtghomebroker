import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

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

    // Update url state when currentUrl prop changes
    React.useEffect(() => {
        setUrl(currentUrl || '');
    }, [currentUrl]);

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

            const { error: updateError } = await supabase
                .from('all_cards')
                .update({ liga_magic_url: url })
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="text-purple-600">⚡</span> Vincular LigaMagic
                    </h3>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                        Cole o link da carta na LigaMagic para monitorarmos o <span className="font-medium text-gray-700">Menor Preço</span> e o <span className="font-medium text-gray-700">Preço Médio</span>.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Link'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
