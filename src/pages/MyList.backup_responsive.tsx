import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { CardPreview } from '../components/CardPreview';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';
import { LigaMagicModal } from '../components/LigaMagicModal';

interface CardData {
    id: number;
    set_name: string;
    name: string;
    ck_buylist_usd: number;
    ck_buylist_credit: number;
    lm_sell_brl: number;
    liga_magic_url?: string;
    imported_at: string;
    ck_last_update: string;
    set_code: string;
    collector_number: string;
    collector_number_normalized: string;
    price_updated_at?: string;
}

interface TrackedTableProps {
    title: string;
    viewName: 'my_tracked_cards_view' | 'my_tracked_sets_view';
    emptyMessage: string;
}

// Subcomponent for Table (Internal)
const TrackedTable: React.FC<TrackedTableProps> = ({ title, viewName, emptyMessage }) => {
    const [data, setData] = useState<CardData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // LigaMagic Modal
    const [lmModalOpen, setLmModalOpen] = useState(false);
    const [selectedCardForLm, setSelectedCardForLm] = useState<{ id: number, url?: string } | null>(null);

    const { trackedCardIds, toggleTrackCard, trackedSetCodes, toggleTrackSet } = useTracking();

    const fetchCards = async () => {
        try {
            let query = supabase.from(viewName).select('*');

            if (searchTerm) {
                query = query.or(`name.ilike.%${searchTerm}%`);
            }

            // Standard sort mapping
            const sortKey = sortConfig.key;
            query = query.order(sortKey, { ascending: sortConfig.direction === 'asc' });

            const { data: cards, error } = await query;
            if (error) throw error;

            setData(cards || []);
        } catch (err: any) {
            console.error(err);
        } finally {
        }
    };

    useEffect(() => {
        fetchCards();
    }, [viewName, sortConfig, trackedCardIds, trackedSetCodes]); // Refresh if tracking changes

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleOpenLmModal = (card: CardData) => {
        setSelectedCardForLm({ id: card.id, url: card.liga_magic_url });
        setLmModalOpen(true);
    };

    const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{title}</h2>
                <div className="search-box">
                    <Search className="search-icon" size={16} />
                    <input
                        className="input"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onBlur={fetchCards} // Simple debounce via blur or effect
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="table-container border-none">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')}>Nome <ArrowUpDown size={12} className="inline" /></th>
                                <th onClick={() => handleSort('set_name')}>Coleção <ArrowUpDown size={12} className="inline" /></th>
                                {viewName === 'my_tracked_cards_view' && (
                                    <>
                                        <th onClick={() => handleSort('ck_buylist_usd')}>Compra CK (USD)</th>
                                        <th onClick={() => handleSort('ck_buylist_credit')}>Compra CK (Créditos)</th>
                                        <th onClick={() => handleSort('lm_sell_brl')}>Venda LM</th>
                                    </>
                                )}
                                <th className="text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length > 0 ? (
                                data.map(card => (
                                    <tr key={card.id}>
                                        <td className="font-bold relative">
                                            {viewName === 'my_tracked_cards_view' ? (
                                                <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                    <Link to={`/carta/${card.id}`} className="hover:text-blue-500">
                                                        {card.name}
                                                    </Link>
                                                </CardPreview>
                                            ) : (
                                                <span>{card.name}</span> // Set name usually implies Card Name is Set Name in this view? Or checking sets view schema? 
                                                // Actually my_tracked_sets_view returns: set_name, set_code, count etc.
                                                // Let's assume generic mapping or fix specifically for Sets if needed. 
                                                // Wait, Sets view usually has 'set_name' as name?
                                                // Let's rely on standard mapping or assume simpler row for Sets.
                                            )}
                                        </td>
                                        <td className="text-gray-500">{card.set_name || card.set_code}</td>

                                        {viewName === 'my_tracked_cards_view' && (
                                            <>
                                                <td className="text-green-600 font-medium">{formatUSD(card.ck_buylist_usd)}</td>
                                                <td className="text-blue-600 font-medium">{formatUSD(card.ck_buylist_credit)}</td>
                                                <td className="text-purple-600">
                                                    {formatBRL(card.lm_sell_brl)}
                                                    {card.liga_magic_url && (
                                                        <a href={card.liga_magic_url} target="_blank" className="ml-2 text-gray-400 hover:text-purple-500"><ExternalLink size={12} className="inline" /></a>
                                                    )}
                                                </td>
                                            </>
                                        )}

                                        <td>
                                            <div className="flex justify-end gap-2">
                                                {viewName === 'my_tracked_cards_view' && (
                                                    <button
                                                        onClick={() => handleOpenLmModal(card)}
                                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                                        title="Vincular LigaMagic"
                                                    >
                                                        <LinkIcon size={16} />
                                                    </button>
                                                )}

                                                {viewName === 'my_tracked_cards_view' ? (
                                                    <TrackButton
                                                        type="card"
                                                        isTracked={true}
                                                        onToggle={() => toggleTrackCard(Number(card.id))}
                                                    />
                                                ) : (
                                                    <TrackButton
                                                        type="set"
                                                        isTracked={true}
                                                        onToggle={() => toggleTrackSet(card.set_code)}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-secondary">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <LigaMagicModal
                isOpen={lmModalOpen}
                onClose={() => setLmModalOpen(false)}
                cardId={selectedCardForLm?.id || null}
                currentUrl={selectedCardForLm?.url}
                onSuccess={() => fetchCards()}
            />
        </div>
    );
};

export const MyList: React.FC = () => {
    return (
        <div>
            <TrackedTable
                title="Cartas que eu acompanho"
                viewName="my_tracked_cards_view"
                emptyMessage="Você não está acompanhando nenhuma carta."
            />

            <div className="h-4"></div>

            <TrackedTable
                title="Coleções que eu acompanho"
                viewName="my_tracked_sets_view"
                emptyMessage="Você não está acompanhando nenhuma coleção."
            />
        </div>
    );
};
