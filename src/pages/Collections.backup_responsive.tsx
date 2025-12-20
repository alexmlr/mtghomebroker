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
    const { trackedCardIds, toggleTrackCard } = useTracking();
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
                .select('id, name, set_name, set_code, collector_number_normalized, collector_number, price_updated_at, ck_buylist_usd, ck_buylist_credit', { count: 'exact' });

            // Set Filter (Using set_code, case insensitive)
            if (selectedSet) {
                query = query.ilike('set_code', selectedSet);
            }

            // Search (Global or filtered)
            if (searchTerm) {
                query = query.ilike('name', `%${searchTerm}%`);
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h1 className="font-bold text-2xl">Lista de Cartas</h1>

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    {/* SET SELECTOR (Uses Code) */}
                    <select
                        className="input max-w-[250px]"
                        value={selectedSet}
                        onChange={(e) => setSelectedSet(e.target.value)}
                    >
                        <option value="">Todas as coleções</option>
                        {sets.map(s => (
                            <option key={s.code} value={s.code}>{s.name} ({s.code.toUpperCase()})</option>
                        ))}
                    </select>

                    <div className="search-box">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar carta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 35, 60, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center" style={{ padding: '3rem' }}>
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p className="text-secondary">Carregando cartas...</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        {/* Columns requested: Name, Set, Foil, CK Prices */}
                                        <th onClick={() => handleSort('name')} className="pl-4 text-left">
                                            <div className="flex items-center gap-2">Nome <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('set_name')}>
                                            <div className="flex items-center gap-2">Coleção <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th>Foil</th>
                                        <th onClick={() => handleSort('ck_buylist_usd')}>
                                            <div className="flex items-center gap-2">Preço (USD) <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('ck_buylist_credit')}>
                                            <div className="flex items-center gap-2">Crédito (USD) <ArrowUpDown size={14} /></div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.length > 0 ? (
                                        data.map((card) => (
                                            <tr key={card.id} className="group hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
                                                <td className="pl-4 py-3 relative">
                                                    <div className="flex items-center gap-2">
                                                        <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                            <Link to={`/carta/${card.id}`} className="font-bold hover:text-blue-500 transition-colors">
                                                                {card.name}
                                                            </Link>
                                                        </CardPreview>

                                                        {/* Hover Track Button */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                <td className="text-secondary">{card.set_name}</td>
                                                <td className="text-gray-400 text-center">-</td>
                                                <td className="text-green-600 font-medium">
                                                    {card.ck_buylist_usd > 0 ? formatUSD(card.ck_buylist_usd) : <span className="text-gray-300">---</span>}
                                                </td>
                                                <td className="text-blue-600 font-medium">
                                                    {card.ck_buylist_credit > 0 ? formatUSD(card.ck_buylist_credit) : <span className="text-gray-300">---</span>}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                Nenhuma carta encontrada.
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
