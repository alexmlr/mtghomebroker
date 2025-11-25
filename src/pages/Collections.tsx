import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { CardPreview } from '../components/CardPreview';

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

export const Collections: React.FC = () => {
    const [data, setData] = useState<CardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CardData | 'ck_buy_credit'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageInput, setPageInput] = useState('1');
    const itemsPerPage = 50;

    // Debounce search
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchCards(currentPage, searchTerm, sortConfig);
    }, [currentPage, sortConfig]); // Fetch when page or sort changes

    // Handle search with debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            setCurrentPage(1); // Reset to page 1 on search
            fetchCards(1, searchTerm, sortConfig);
        }, 500); // 500ms debounce

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchTerm]);

    const fetchCards = async (page: number, search: string, sort: typeof sortConfig) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('cards')
                .select('id, name, set_name, set_code, collector_number_normalized, imported_at, ck_buy_usd, lm_sell_brl', { count: 'exact' });

            // Search
            if (search) {
                // Use .or() to search in name OR set_name
                query = query.or(`name.ilike.%${search}%,set_name.ilike.%${search}%`);
            }

            // Sorting
            if (sort.key === 'ck_buy_credit') {
                // We can't sort by calculated column on server easily without a computed column or function.
                // Fallback: sort by ck_buy_usd since credit is just a multiplier of it.
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
            console.error('Error fetching cards:', err);
            setError('Erro ao carregar dados. Verifique sua conexão ou as credenciais.');
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
                // Reset input to current page if invalid
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
        <div>
            <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <h1 className="font-bold" style={{ fontSize: '1.5rem' }}>Coleções</h1>

                <div className="search-box">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar carta ou coleção..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                                            <tr key={card.id}>
                                                <td className="text-secondary">{card.set_name}</td>
                                                <td className="font-bold">
                                                    <CardPreview set_code={card.set_code} collector_number={card.collector_number_normalized}>
                                                        <span className="hover:text-blue-400 transition-colors">{card.name}</span>
                                                    </CardPreview>
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
                                                Nenhuma carta encontrada.
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
