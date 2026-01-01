import React, { useState } from 'react';
import { X, Upload, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTracking } from '../hooks/useTracking';

interface ImportListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ProcessedCard {
    originalText: string;
    status: 'pending' | 'found' | 'not_found' | 'error';
    cardName?: string;
    setName?: string;
    setCode?: string;
    cardId?: number;
    errorMsg?: string;
}

export const ImportListModal: React.FC<ImportListModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedList, setProcessedList] = useState<ProcessedCard[]>([]);
    const [step, setStep] = useState<'input' | 'preview'>('input');

    // Tracking hook to add cards
    const { trackedCardIds } = useTracking();

    if (!isOpen) return null;

    const parseLine = (line: string): { name: string, setCode?: string } | null => {
        // Regex to match: optional qty, name, optional [EDICAO=CODE]
        // Examples: 
        // "1 Starscape Cleric [EDICAO=BLB]"
        // "Starscape Cleric [EDICAO=BLB]"
        // "Cleriga [EDICAO=BLB]"

        const cleanLine = line.trim();
        if (!cleanLine) return null;

        // Regex explanation:
        // ^(?:(\d+)\s+)?  -> Optional Quantity at start (Ignored)
        // (.+?)           -> Name (Lazy capture)
        // \s*             -> Optional whitespace
        // (?:\[EDICAO=([A-Za-z0-9]+)\])?$ -> Optional Set Code block
        const regex = /^(?:(\d+)\s+)?(.+?)\s*(?:\[EDICAO=([A-Za-z0-9]+)\])?$/i;

        const match = cleanLine.match(regex);
        if (!match) return { name: cleanLine }; // Fallback: try whole line as name

        return {
            name: match[2].trim(), // Name is group 2
            setCode: match[3]?.trim() // Set Code is group 3 (optional)
        };
    };

    const findCardInDb = async (name: string, setCode?: string) => {
        let query = supabase
            .from('all_cards')
            .select('id, name, set_name, set_code')
            .ilike('name', name); // Case insensitive

        if (setCode) {
            query = query.eq('set_code', setCode.toUpperCase());
        }

        // Limit to 1 for exact match logic
        const { data, error } = await query.limit(1);

        if (!error && data && data.length > 0) {
            return data[0];
        }
        return null;
    };

    const findViaScryfall = async (name: string, setCode?: string) => {
        try {
            // Construct fuzzy search URL
            let url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
            if (setCode) {
                url += `&set=${setCode}`;
            }

            const res = await fetch(url);
            if (!res.ok) return null;

            const sfData = await res.json();

            // Return English Name and Set Code to try DB lookup again
            return {
                englishName: sfData.name,
                set: sfData.set // Scryfall set code
            };
        } catch (err) {
            console.error("Scryfall lookup error:", err);
            return null;
        }
    };

    const processText = async () => {
        setIsProcessing(true);
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const results: ProcessedCard[] = [];

        // Process sequentially to be nice to API rates if needed, 
        // though Promise.all is faster. Scryfall asks for 50-100ms spacing usually.
        // We'll process sequentially to avoid rate limits safely since user might paste 100 cards.

        for (const line of lines) {
            const parsed = parseLine(line);

            if (!parsed) {
                results.push({ originalText: line, status: 'error', errorMsg: 'Formato inválido' });
                continue;
            }

            // 1. Try DB First
            let dbCard = await findCardInDb(parsed.name, parsed.setCode);

            // 2. If not found, Try Scryfall (Portuguese/Fuzzy)
            if (!dbCard) {
                // Wait small delay 
                await new Promise(r => setTimeout(r, 50));

                const sfMatch = await findViaScryfall(parsed.name, parsed.setCode);

                if (sfMatch) {
                    // 3. Try DB Again with resolved English Name
                    // Note: Scryfall returns 3-char set code, assume matches our DB
                    dbCard = await findCardInDb(sfMatch.englishName, sfMatch.set);

                    // Fallback: If Set code mismatch (maybe Scryfall has 'dom' we have 'dom'), try just Name
                    if (!dbCard) {
                        dbCard = await findCardInDb(sfMatch.englishName);
                    }
                }
            }

            if (dbCard) {
                results.push({
                    originalText: line,
                    status: 'found',
                    cardId: dbCard.id,
                    cardName: dbCard.name,
                    setName: dbCard.set_name,
                    setCode: dbCard.set_code
                });
            } else {
                results.push({
                    originalText: line,
                    status: 'not_found',
                    errorMsg: 'Carta não encontrada no banco de dados'
                });
            }
        }

        setProcessedList(results);
        setStep('preview');
        setIsProcessing(false);
    };

    const handleImport = async () => {
        const toImport = processedList.filter(p => p.status === 'found' && p.cardId);

        setIsProcessing(true);

        try {
            const idsToProcess = toImport.map(p => p.cardId!);

            // Fix: 'trackedCardIds' is a Set, use .has(), not .includes()
            const newIds = idsToProcess.filter(id => !trackedCardIds.has(id));

            if (newIds.length === 0) {
                onClose();
                onSuccess();
                return;
            }

            // Accessing supabase directly to avoid toggle-off risk
            const userRes = await supabase.auth.getUser();
            const userId = userRes.data.user?.id;

            if (userId) {
                const rows = newIds.map(id => ({ user_id: userId, card_id: id }));
                const { error } = await supabase.from('user_tracked_cards').upsert(rows);
                if (error) throw error;
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error("Import error", err);
            // Optionally show error to user
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setText('');
        setProcessedList([]);
        setStep('input');
    }

    // Counts
    const foundCount = processedList.filter(p => p.status === 'found').length;
    const notFoundCount = processedList.filter(p => p.status !== 'found').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Upload size={20} className="text-blue-500" />
                        Importar Lista
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {step === 'input' ? (
                        <>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                                Cole sua lista abaixo. Cada carta em uma linha.<br />
                                <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded">1 Nome da Carta [EDICAO=CODIGO]</span>
                            </p>
                            <textarea
                                className="w-full h-64 p-4 text-sm font-mono bg-[var(--inner-bg)] border border-[var(--inner-border)] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                                placeholder={`Exemplos:\n1 Starscape Cleric [EDICAO=BLB]\nClériga do Firmamento [EDICAO=BLB]\nSol Ring`}
                                value={text}
                                onChange={e => setText(e.target.value)}
                            />
                            <div className="mt-4 flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 p-2 rounded-lg">
                                <AlertCircle size={14} />
                                Lista grande com nomes em português pode demorar um pouco para processar.
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-4 mb-4">
                                <div className="flex-1 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/30">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{foundCount}</div>
                                    <div className="text-xs text-green-700 dark:text-green-500 font-medium">Encontradas</div>
                                </div>
                                <div className="flex-1 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/30">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{notFoundCount}</div>
                                    <div className="text-xs text-red-700 dark:text-red-500 font-medium">Não Encontradas</div>
                                </div>
                            </div>

                            <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-4 py-2">Original</th>
                                            <th className="px-4 py-2">Resultado</th>
                                            <th className="px-4 py-2 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {processedList.map((item, idx) => (
                                            <tr key={idx} className="bg-white dark:bg-slate-900">
                                                <td className="px-4 py-2 font-mono text-xs truncate max-w-[150px]" title={item.originalText}>
                                                    {item.originalText}
                                                </td>
                                                <td className="px-4 py-2 truncate max-w-[200px]">
                                                    {item.status === 'found' ? (
                                                        <span className="flex flex-col">
                                                            <span className="font-medium text-gray-900 dark:text-white">{item.cardName}</span>
                                                            <span className="text-[10px] text-gray-500">{item.setName} ({item.setCode})</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-500 text-xs">{item.errorMsg}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {item.status === 'found' ? (
                                                        <CheckCircle size={16} className="text-green-500 ml-auto" />
                                                    ) : (
                                                        <AlertCircle size={16} className="text-red-500 ml-auto" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
                    {step === 'input' ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={processText}
                                disabled={!text.trim() || isProcessing}
                                className="px-6 py-2 btn btn-primary flex items-center gap-2"
                            >
                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                Processar Lista
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                                Voltar / Editar
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isProcessing || foundCount === 0}
                                className="px-6 py-2 btn btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700 border-none"
                            >
                                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                Importar {foundCount} cartas
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
