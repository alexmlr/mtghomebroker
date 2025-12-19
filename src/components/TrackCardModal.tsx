import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface TrackCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: any[]) => void;
}

export const TrackCardModal: React.FC<TrackCardModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [ckUrl, setCkUrl] = useState('');
    const [lmUrl, setLmUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        setLoading(true);
        setLoadingMessage('Acessando Card Kingdom...'); // Initial message

        try {
            // Call local scraper API for Card Kingdom
            const response = await fetch('http://localhost:3001/scrape/card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: ckUrl }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Falha ao rastrear carta.');
            }

            // If we have a LigaMagic URL, scrape it too!
            // We need the Card ID from the first scrape to link it.
            if (lmUrl && data.data && data.data.length > 0) {
                const cardData = data.data[0];
                const cardId = cardData.id;
                const isFoil = cardData.foil; // This comes from scrapeCard result

                setLoadingMessage(`Rastreando dados da LigaMagic (${isFoil ? 'Foil' : 'Normal'})...`);

                try {
                    await fetch('http://localhost:3001/scrape/ligamagic', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: lmUrl, cardId: cardId, isFoil: isFoil }),
                    });
                    // We don't strictly fail the whole process if LM fails, but we could warn
                } catch (lmError) {
                    console.error('Erro ao rastrear LigaMagic:', lmError);
                    alert('Carta rastreada no Card Kingdom, mas houve erro ao acessar a LigaMagic via Link.');
                }
            }

            // Success
            setCkUrl('');
            setLmUrl('');
            onSuccess(data.data); // Trigger refresh on parent and pass data for auto-tracking
            onClose();

        } catch (err: any) {
            console.error('Error tracking card:', err);
            setError(err.message || 'Erro de conexão com o servidor de scraping.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">Acompanhar Nova Carta</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Warning Alert */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-amber-700">
                                    Atenção ao copiar os links: escolha a versão da carta da <strong>mesma coleção</strong> em ambos os sites.
                                    Caso seja uma carta <strong>Foil</strong>, verifique se a versão no CardKingdom também é Foil.
                                </p>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Link Card Kingdom (Buylist) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="url"
                            required
                            placeholder="https://www.cardkingdom.com/purchasing/..."
                            value={ckUrl}
                            onChange={(e) => setCkUrl(e.target.value)}
                            disabled={loading}
                            className="input w-full border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-secondary mt-1">
                            Cole o link direto da carta ou da busca na Buylist.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Link LigaMagic (Opcional)
                        </label>
                        <input
                            type="url"
                            placeholder="https://www.ligamagic.com.br/..."
                            value={lmUrl}
                            onChange={(e) => setLmUrl(e.target.value)}
                            disabled={loading}
                            className="input w-full border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        />
                        <p className="text-xs text-secondary mt-1">
                            Será usado futuramente para comparação de preços.
                        </p>
                    </div>

                    {/* Loading Message Box */}
                    {loading && (
                        <div className="rounded-md bg-blue-50 p-4 border border-blue-100 animate-pulse">
                            <div className="flex justify-center">
                                <div className="ml-3 flex-1 md:flex md:justify-between items-center text-center">
                                    <p className="text-sm text-blue-700 font-medium">
                                        {loadingMessage || 'Processando...'}
                                    </p>
                                    <Loader2 className="w-4 h-4 text-blue-700 animate-spin ml-2 inline-block" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary min-w-[120px]"
                            disabled={loading}
                        >
                            {loading ? 'Aguarde...' : 'Rastrear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
