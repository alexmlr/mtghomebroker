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
        <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-base md:text-xl font-bold">{title}</h2>
                <div className="search-box">
                    <Search className="search-icon" size={14} style={{ top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        className="input text-[11px] py-1 h-8"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onBlur={fetchCards} // Simple debounce via blur or effect
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="table-container border-none overflow-x-auto" style={{ padding: '0 4px 4px' }}>
                    <table className="w-full min-w-[350px] md:min-w-full">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')} className="pl-3 text-left py-1 md:py-3 text-[10px] md:text-sm">
                                    <div className="flex items-center gap-0.5">Nome <ArrowUpDown size={8} className="inline" /></div>
                                </th>
                                <th onClick={() => handleSort('set_name')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap md:whitespace-normal">
                                    <div className="flex items-center gap-0.5">Col <ArrowUpDown size={8} className="inline" /></div>
                                </th>
                                {viewName === 'my_tracked_cards_view' && (
                                    <>
                                        <th onClick={() => handleSort('ck_buylist_usd')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">CK(USD)</th>
                                        <th onClick={() => handleSort('ck_buylist_credit')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">CK(Créd)</th>
                                        <th onClick={() => handleSort('lm_sell_brl')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">LM</th>
                                    </>
                                )}
                                <th className="text-right px-2 py-1 md:py-3 text-[10px] md:text-sm">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.length > 0 ? (
                                data.map(card => (
                                    <tr key={card.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="font-bold relative py-1 md:py-3 pl-3 min-w-[120px]">
                                            {viewName === 'my_tracked_cards_view' ? (
                                                <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                    <Link to={`/carta/${card.id}`} className="hover:text-blue-500 text-[11px] md:text-base line-clamp-2 leading-tight">
                                                        {card.name}
                                                    </Link>
                                                </CardPreview>
                                            ) : (
                                                <span className="text-[11px] md:text-base">{card.name}</span>
                                            )}
                                        </td>
                                        <td className="text-gray-500 text-[9px] md:text-sm px-0.5 truncate max-w-[60px] md:max-w-[200px]">{card.set_name || card.set_code}</td>

                                        {viewName === 'my_tracked_cards_view' && (
                                            <>
                                                <td className="text-green-600 font-medium text-[9px] md:text-sm px-0.5">{formatUSD(card.ck_buylist_usd)}</td>
                                                <td className="text-blue-600 font-medium text-[9px] md:text-sm px-0.5">{formatUSD(card.ck_buylist_credit)}</td>
                                                <td className="text-purple-600 text-[9px] md:text-sm px-0.5">
                                                    {formatBRL(card.lm_sell_brl)}
                                                    {card.liga_magic_url && (
                                                        <a href={card.liga_magic_url} target="_blank" className="ml-1 text-gray-400 hover:text-purple-500"><ExternalLink size={10} className="inline" /></a>
                                                    )}
                                                </td>
                                            </>
                                        )}

                                        <td className="px-2">
                                            <div className="flex justify-end gap-1">
                                                {viewName === 'my_tracked_cards_view' && (
                                                    <button
                                                        onClick={() => handleOpenLmModal(card)}
                                                        className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                                        title="Vincular LigaMagic"
                                                    >
                                                        <LinkIcon size={12} />
                                                    </button>
                                                )}

                                                <div className="scale-75 md:scale-100 origin-right">
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
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-4 text-secondary text-[10px] md:text-sm">
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
