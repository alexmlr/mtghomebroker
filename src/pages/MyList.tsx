import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Link as LinkIcon, ExternalLink, Plus, Pencil } from 'lucide-react';
import { CardPreview } from '../components/CardPreview';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';
import { LigaMagicModal } from '../components/LigaMagicModal';
import { ImportListModal } from '../components/ImportListModal';
import { EditCollectionModal } from '../components/EditCollectionModal';

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
    onImportClick?: () => void;
}

// Subcomponent for Table (Internal)
const TrackedTable: React.FC<TrackedTableProps> = ({ title, viewName, emptyMessage, onImportClick }) => {
    const [data, setData] = useState<CardData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // LigaMagic Modal
    const [lmModalOpen, setLmModalOpen] = useState(false);
    const [selectedCardForLm, setSelectedCardForLm] = useState<{ id: number, url?: string } | null>(null);

    // Edit Collection Modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<CardData | null>(null);

    const { trackedCardIds, toggleTrackCard, trackedSetCodes, toggleTrackSet } = useTracking();

    const fetchCards = async () => {
        try {
            if (viewName === 'my_tracked_sets_view') {
                // Fetch tracked sets IDs/Codes
                const { data: trackedData, error: trackedError } = await supabase
                    .from('user_tracked_sets')
                    .select('set_code');

                if (trackedError) throw trackedError;

                const setCodes = trackedData?.map(t => t.set_code) || [];

                if (setCodes.length === 0) {
                    setData([]);
                } else {
                    // Fetch Cards for these Sets
                    let query = supabase
                        .from('all_cards_with_prices')
                        .select('*');

                    // Filter by tracked sets
                    query = query.in('set_code', setCodes);

                    // Apply Search
                    if (searchTerm) {
                        query = query.ilike('name', `%${searchTerm}%`);
                    }

                    // Apply Sort
                    const sortKey = sortConfig.key;
                    query = query.order(sortKey, { ascending: sortConfig.direction === 'asc' });

                    // Supabase default limit is 1000
                    const { data: cards, error } = await query;
                    if (error) throw error;

                    setData(cards || []);
                }

            } else {
                // Logic for Cards (View exists)
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
            }
        } catch (err: any) {
            console.error(err);
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

    const handleOpenEditModal = (card: CardData) => {
        setCardToEdit(card);
        setEditModalOpen(true);
    };

    const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const currentData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset to page 1 when data changes (e.g. search or view change)
    useEffect(() => {
        setCurrentPage(1);
    }, [data.length, viewName, searchTerm]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-xl font-bold">{title}</h2>
                    {onImportClick && (
                        <button
                            onClick={onImportClick}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] md:text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors font-medium shadow-sm"
                        >
                            <Plus size={12} />
                            Importar Lista
                        </button>
                    )}
                </div>
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
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
                                {/* ALWAYS SHOW PRICES NOW, since it's a card list */}
                                <th onClick={() => handleSort('ck_buylist_usd')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">CK(USD)</th>
                                <th onClick={() => handleSort('ck_buylist_credit')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">CK(Créd)</th>
                                <th onClick={() => handleSort('lm_sell_brl')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm whitespace-nowrap">LM</th>
                                <th className="text-right px-2 py-1 md:py-3 text-[10px] md:text-sm">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.length > 0 ? (
                                currentData.map(card => (
                                    <tr key={card.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group">
                                        <td className="font-bold relative py-1 md:py-3 pl-3 min-w-[120px]">
                                            <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                <Link to={`/carta/${card.id}`} className="hover:text-blue-500 text-[11px] md:text-base line-clamp-2 leading-tight">
                                                    {card.name}
                                                </Link>
                                            </CardPreview>
                                        </td>
                                        <td className="px-0.5">
                                            <div className="flex items-center gap-1">
                                                <span className="truncate max-w-[60px] md:max-w-[180px] text-[11px] md:text-base">{card.set_name || card.set_code}</span>
                                                {viewName === 'my_tracked_cards_view' && (
                                                    <button
                                                        onClick={() => handleOpenEditModal(card)}
                                                        className="text-gray-300 group-hover:bg-white group-hover:text-blue-600 group-hover:border group-hover:border-blue-200 p-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shadow-sm"
                                                        title="Trocar Edição"
                                                    >
                                                        <Pencil size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        <td className="text-green-600 font-medium text-[9px] md:text-sm px-0.5">{formatUSD(card.ck_buylist_usd)}</td>
                                        <td className="text-blue-600 font-medium text-[9px] md:text-sm px-0.5">{formatUSD(card.ck_buylist_credit)}</td>
                                        <td className="text-purple-600 text-[9px] md:text-sm px-0.5">
                                            {formatBRL(card.lm_sell_brl)}
                                            {card.liga_magic_url && (
                                                <a href={card.liga_magic_url} target="_blank" className="ml-1 text-gray-400 hover:text-purple-500"><ExternalLink size={10} className="inline" /></a>
                                            )}
                                        </td>

                                        <td className="px-2">
                                            <div className="flex justify-end gap-1">
                                                {viewName === 'my_tracked_cards_view' && (
                                                    <button
                                                        onClick={() => handleOpenLmModal(card)}
                                                        className="p-1 px-2 text-gray-300 md:text-gray-300 group-hover:text-purple-600 group-hover:bg-purple-50 group-hover:border group-hover:border-purple-200 rounded transition-all md:opacity-0 md:group-hover:opacity-100"
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

            {/* Pagination Footer */}
            {data.length > 0 && (
                <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs md:text-sm text-gray-600 px-1">
                    <div className="flex items-center gap-2">
                        <span>Items por página:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white border border-gray-300 rounded px-1 py-0.5"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span className="hidden md:inline">
                            | Total: {data.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            Anterior
                        </button>
                        <span>
                            Página {currentPage} de {totalPages || 1}
                        </span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <LigaMagicModal
                isOpen={lmModalOpen}
                onClose={() => setLmModalOpen(false)}
                cardId={selectedCardForLm?.id || null}
                currentUrl={selectedCardForLm?.url}
                onSuccess={() => fetchCards()}
            />

            <EditCollectionModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                originalCard={cardToEdit}
                onSuccess={() => {
                    fetchCards();
                }}
            />
        </div>
    );
};

export const MyList: React.FC = () => {
    const [importModalOpen, setImportModalOpen] = useState(false);

    return (
        <div>
            <TrackedTable
                title="Cartas que eu acompanho"
                viewName="my_tracked_cards_view"
                emptyMessage="Você não está acompanhando nenhuma carta."
                onImportClick={() => setImportModalOpen(true)}
            />

            <div className="h-4"></div>

            <TrackedTable
                title="Coleções que eu acompanho"
                viewName="my_tracked_sets_view"
                emptyMessage="Você não está acompanhando nenhuma coleção."
            />

            <ImportListModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onSuccess={() => {
                    window.location.reload();
                }}
            />
        </div>
    );
};
