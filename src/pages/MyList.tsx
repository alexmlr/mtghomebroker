import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { CardPreview } from '../components/CardPreview';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';

interface CardData {
    id: number;
    set_name: string;
    name: string;
    ck_buy_usd: number;
    lm_sell_brl: number;
    imported_at: string;
    set_code: string;
    collector_number_normalized: string;
}

interface TrackedTableProps {
    title: string;
    viewName: 'my_tracked_cards_view' | 'my_tracked_sets_view';
    emptyMessage: string;
}

const TrackedTable: React.FC<TrackedTableProps> = ({ title, viewName, emptyMessage }) => {
    const [data, setData] = useState<CardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CardData | 'ck_buy_credit'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    const [sets, setSets] = useState<string[]>([]);
    const [selectedSet, setSelectedSet] = useState('');

    // Tracking
    const { trackedCardIds, trackedSetCodes, toggleTrackCard, toggleTrackSet } = useTracking();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageInput, setPageInput] = useState('1');
    const itemsPerPage = 20; // Reduced items per page since we have two tables

    // Debounce search
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch sets for this specific view
    useEffect(() => {
        const fetchSets = async () => {
            try {
                const { data, error } = await supabase
                    .from(viewName)
                    .select('set_name');

                if (error) throw error;

                if (data) {
                    const uniqueSets = Array.from(new Set(data.map((item: any) => item.set_name))).sort();
                    setSets(uniqueSets);
                }
            } catch (err) {
                console.error(`Error fetching sets for ${viewName}:`, err);
            }
        };
        fetchSets();
    }, [viewName, trackedCardIds, trackedSetCodes]);

    useEffect(() => {
        fetchCards(currentPage, searchTerm, sortConfig, selectedSet);
    }, [currentPage, sortConfig, selectedSet, trackedCardIds, trackedSetCodes, viewName]);

    // Handle search with debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 on search
            fetchCards(1, searchTerm, sortConfig, selectedSet);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchTerm]);

    const fetchCards = async (page: number, search: string, sort: typeof sortConfig, setFilter: string) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from(viewName)
                .select('id, name, set_name, set_code, collector_number_normalized, imported_at, ck_buy_usd, lm_sell_brl', { count: 'exact' });

            // Set Filter
            if (setFilter) {
                query = query.eq('set_name', setFilter);
            }

            // Search
            if (search) {
                query = query.or(`name.ilike.%${search}%,set_name.ilike.%${search}%`);
            }

            // Sorting
            if (sort.key === 'ck_buy_credit') {
                query = query.order('ck_buy_usd', { ascending: sort.direction === 'asc' });
            } else {
                query = query.order(sort.key, { ascending: sort.direction === 'asc' });
            }

            // Pagination
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;
            query = query.range(from, to);

            const { data: cards, count, error } = await query;

            if (error) throw error;

            setData(cards || []);
            if (count !== null) setTotalCount(count);
            setPageInput(page.toString());

        } catch (err: any) {
            console.error(`Error fetching cards for ${viewName}:`, err);
            setError('Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof CardData | 'ck_buy_credit') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const page = parseInt(pageInput);
            if (!isNaN(page) && page >= 1 && page <= Math.ceil(totalCount / itemsPerPage)) {
                setCurrentPage(page);
            } else {
                setPageInput(currentPage.toString());
            }
        }
    };

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
    };

    const formatCurrencyBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatDate = (dateString: string) => {
        try {
            return format(new Date(dateString), 'dd/MM/yy');
        } catch {
            return dateString;
        }
    };

    return (
        <div className="mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center mb-4 gap-4">
                <h2 className="font-bold text-xl" style={{ marginRight: 'auto' }}>{title}</h2>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        className="input"
                        style={{ maxWidth: '200px' }}
                        value={selectedSet}
                        onChange={(e) => {
                            setSelectedSet(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="">Todas as coleções</option>
                        {sets.map((set) => (
                            <option key={set} value={set}>
                                {set}
                            </option>
                        ))}
                    </select>

                    <div className="search-box flex-1 md:w-64">
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
                        <p className="text-secondary">Carregando...</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('set_name')}>
                                            <div className="flex items-center gap-2">Coleção <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-2">Nome <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('ck_buy_usd')} title="Preço em USD na Lista de compras na CardKingdom">
                                            <div className="flex items-center gap-2">Compra CK (USD) <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('ck_buy_credit')} title="Preço em Créditos na Lista de compras na CardKingdom">
                                            <div className="flex items-center gap-2">Compra CK (Créditos) <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('lm_sell_brl')} title="Preço de venda em Real na LigaMagic">
                                            <div className="flex items-center gap-2">Venda LM <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('imported_at')}>
                                            <div className="flex items-center gap-2">Data da cotação <ArrowUpDown size={14} /></div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.length > 0 ? (
                                        data.map((card) => (
                                            <tr key={card.id} className="group hover:bg-gray-50">
                                                <td className="text-secondary relative">
                                                    <div className="flex items-center gap-2">
                                                        {card.set_name}
                                                        <TrackButton
                                                            type="set"
                                                            isTracked={trackedSetCodes.has(card.set_code)}
                                                            onToggle={(e) => {
                                                                e.stopPropagation();
                                                                toggleTrackSet(card.set_code);
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="font-bold relative">
                                                    <div className="flex items-center gap-2">
                                                        <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                            <span className="hover:text-blue-400 transition-colors">{card.name}</span>
                                                        </CardPreview>
                                                        <TrackButton
                                                            type="card"
                                                            isTracked={trackedCardIds.has(card.id)}
                                                            onToggle={(e) => {
                                                                e.stopPropagation();
                                                                toggleTrackCard(card.id);
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td>{formatCurrency(card.ck_buy_usd)}</td>
                                                <td>{formatCurrency(card.ck_buy_usd * 1.3)}</td>
                                                <td>{formatCurrencyBRL(card.lm_sell_brl)}</td>
                                                <td className="text-secondary">{formatDate(card.imported_at)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                {emptyMessage}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
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
                                <div className="w-4"></div> {/* Spacer */}
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
                    </>
                )}
            </div>
        </div>
    );
};

export const MyList: React.FC = () => {
    return (
        <div>
            <TrackedTable
                title="Cartas que eu acompanho"
                viewName="my_tracked_cards_view"
                emptyMessage="Você não está acompanhando nenhuma carta individualmente."
            />

            <div className="h-8"></div> {/* Spacer */}

            <TrackedTable
                title="Coleções que eu acompanho"
                viewName="my_tracked_sets_view"
                emptyMessage="Você não está acompanhando nenhuma coleção."
            />
        </div>
    );
};
