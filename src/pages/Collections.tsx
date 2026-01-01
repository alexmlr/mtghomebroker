import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { CardPreview } from '../components/CardPreview';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';

interface CardData {
    id: number;
    set_name: string;
    name: string;
    ck_buylist_usd: number;
    ck_buylist_credit: number;
    set_code: string;
    collector_number: string;
    collector_number_normalized: string;
    price_updated_at: string;
    is_foil: boolean;
}

export const Collections: React.FC = () => {
    // State
    const [sets, setSets] = useState<{ code: string, name: string }[]>([]);
    const [selectedSet, setSelectedSet] = useState('');

    // Table State
    const [data, setData] = useState<CardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageInput, setPageInput] = useState('1');
    const itemsPerPage = 50;

    // Tracking
    const { trackedCardIds, toggleTrackCard, trackedSetCodes, toggleTrackSet } = useTracking();
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Fetch Sets from DB
    useEffect(() => {
        const loadSets = async () => {
            try {
                const { data: setsData } = await supabase
                    .from('sets')
                    .select('code, name')
                    .order('name');
                if (setsData) setSets(setsData);
            } catch (err) {
                console.error("Error loading sets:", err);
            }
        };
        loadSets();
    }, []);

    // 2. Fetch Cards
    const fetchCards = async () => {
        setLoading(true);
        setError(null);

        try {
            // Use View
            let query = supabase
                .from('all_cards_with_prices')
                .select('id, name, set_name, set_code, collector_number_normalized, collector_number, price_updated_at, ck_buylist_usd, ck_buylist_credit, is_foil', { count: 'exact' });

            // Set Filter (Using set_code, case insensitive)
            if (selectedSet) {
                query = query.ilike('set_code', selectedSet);
            }

            // Search (Global or filtered)
            if (searchTerm) {
                query = query.ilike('name', `%${searchTerm}%`);
            } else {
                // Default: Only show cards with CK Price > 0 when not searching
                query = query.gt('ck_buylist_usd', 0);
            }

            // Sorting
            query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc', nullsFirst: false });

            // Pagination
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data: cards, count, error } = await query;
            if (error) throw error;

            const mapped = cards?.map((c: any) => ({
                ...c,
                ck_buylist_usd: c.ck_buylist_usd || 0,
                ck_buylist_credit: c.ck_buylist_credit || 0
            })) || [];

            setData(mapped);
            if (count !== null) setTotalCount(count);
            setPageInput(currentPage.toString());

        } catch (err: any) {
            console.error("Error fetching cards:", err);
            setError('Erro ao carregar dados. Verifique a conexão com o banco.');
        } finally {
            setLoading(false);
        }
    };

    // Trigger Fetch
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchCards();
        }, 500);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [selectedSet, searchTerm, currentPage, sortConfig]);

    // Force reset page when set/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedSet, searchTerm]);


    // Handlers
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const page = parseInt(pageInput);
            if (!isNaN(page) && page >= 1 && page <= totalPages) {
                setCurrentPage(page);
            } else {
                setPageInput(currentPage.toString());
            }
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2">
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                    {/* SET SELECTOR */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <select
                            className="input text-[11px] flex-1 md:w-[250px] py-0 px-2"
                            value={selectedSet}
                            onChange={(e) => setSelectedSet(e.target.value)}
                        >
                            <option value="">Todas as coleções</option>
                            {sets.map(s => (
                                <option key={s.code} value={s.code}>{s.name} ({s.code.toUpperCase()})</option>
                            ))}
                        </select>

                        {selectedSet && (
                            <button
                                onClick={() => toggleTrackSet(selectedSet)}
                                className={`
                                    flex items-center gap-1 px-3 py-1.5 ml-2 rounded-md text-xs font-medium transition-colors border shadow-sm whitespace-nowrap
                                    ${trackedSetCodes.has(selectedSet)
                                        ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-red-100 hover:text-red-700 hover:border-red-200'
                                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                    }
                                `}
                                title={trackedSetCodes.has(selectedSet) ? "Parar de acompanhar esta coleção" : "Acompanhar variações de preço desta coleção"}
                            >
                                {trackedSetCodes.has(selectedSet) ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                                        Seguindo
                                    </>
                                ) : (
                                    <>
                                        <span>+ Acompanhar</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* SEARCH BOX */}
                    <div className="relative w-full md:w-[250px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                        <input
                            type="text"
                            className="input text-[11px] w-full pl-8"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 35, 60, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    {error}
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-4">
                        <Loader2 className="animate-spin mb-2" size={20} />
                        <p className="text-secondary text-xs">Carregando cartas...</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container overflow-x-auto" style={{ border: 'none', padding: '0 4px 4px' }}>
                            <table className="w-full min-w-[350px] md:min-w-full">
                                <thead>
                                    <tr>
                                        {/* Columns requested: Name, Set, Foil, CK Prices */}
                                        <th onClick={() => handleSort('name')} className="pl-2 md:pl-4 text-left py-1 md:py-3 text-[10px] md:text-sm">
                                            <div className="flex items-center gap-0.5">Nome <ArrowUpDown size={8} /></div>
                                        </th>
                                        <th onClick={() => handleSort('set_name')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm">
                                            <div className="flex items-center gap-0.5">Col <ArrowUpDown size={8} /></div>
                                        </th>
                                        <th className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm text-center">Foil</th>
                                        <th onClick={() => handleSort('ck_buylist_usd')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm">
                                            <div className="flex items-center gap-0.5">USD <ArrowUpDown size={8} /></div>
                                        </th>
                                        <th onClick={() => handleSort('ck_buylist_credit')} className="px-0.5 py-1 md:py-3 text-[10px] md:text-sm">
                                            <div className="flex items-center gap-0.5">Créd <span className="hidden md:inline">(USD)</span> <ArrowUpDown size={8} /></div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.length > 0 ? (
                                        data.map((card) => (
                                            <tr key={card.id} className="group hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                                                <td className="pl-2 md:pl-4 py-1 md:py-3 relative min-w-[120px]">
                                                    <div className="flex items-center gap-1">
                                                        <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                            <Link to={`/carta/${card.id}`} className="font-bold hover:text-blue-500 transition-colors text-[11px] md:text-base line-clamp-2 leading-tight">
                                                                {card.name}
                                                            </Link>
                                                        </CardPreview>

                                                        {/* Hover Track Button - Visible on Mobile (Smaller) */}
                                                        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 scale-75 md:scale-100 origin-left">
                                                            <TrackButton
                                                                type="card"
                                                                isTracked={trackedCardIds.has(Number(card.id))}
                                                                onToggle={async (e) => {
                                                                    e.stopPropagation();
                                                                    console.log(`Check Button Clicked: ${card.id}`);
                                                                    await toggleTrackCard(Number(card.id));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-secondary text-[9px] md:text-sm px-0.5 text-center md:text-left whitespace-nowrap md:whitespace-normal max-w-[60px] md:max-w-[200px]">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate">{card.set_name}</span>
                                                        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 scale-75 md:scale-100">
                                                            <TrackButton
                                                                type="set"
                                                                isTracked={trackedSetCodes.has(card.set_code)}
                                                                onToggle={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleTrackSet(card.set_code);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-gray-400 text-center text-[9px] md:text-sm">
                                                    {card.is_foil ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-bold uppercase tracking-wider">Foil</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="text-green-600 font-medium text-[9px] md:text-sm px-0.5">
                                                    {card.ck_buylist_usd > 0 ? formatUSD(card.ck_buylist_usd) : <span className="text-gray-300">---</span>}
                                                </td>
                                                <td className="text-blue-600 font-medium text-[9px] md:text-sm px-0.5">
                                                    {card.ck_buylist_credit > 0 ? formatUSD(card.ck_buylist_credit) : <span className="text-gray-300">---</span>}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                Nenhuma carta.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 0 && (
                            <div className="flex justify-between items-center" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                                <span className="text-sm text-secondary">
                                    Página {currentPage} de {totalPages} ({totalCount} itens)
                                </span>
                                <div className="flex gap-2 items-center">
                                    <span className="text-sm text-secondary mr-2">Ir para:</span>
                                    <input
                                        type="number"
                                        className="input input-sm"
                                        style={{ width: '60px', textAlign: 'center' }}
                                        value={pageInput}
                                        onChange={(e) => setPageInput(e.target.value)}
                                        onKeyDown={handlePageInputKeyDown}
                                        min={1}
                                        max={totalPages}
                                    />
                                    <div className="w-4"></div>
                                    <button
                                        className="btn btn-ghost text-sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        style={{ opacity: currentPage === 1 ? 0.5 : 1, pointerEvents: currentPage === 1 ? 'none' : 'auto' }}
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        className="btn btn-ghost text-sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        style={{ opacity: currentPage === totalPages ? 0.5 : 1, pointerEvents: currentPage === totalPages ? 'none' : 'auto' }}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
