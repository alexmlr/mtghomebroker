import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface CardData {
    id: number;
    collection: string;
    name: string;
    buy_usd: number;
    credit_usd: number;
    scraped_at: string;
}

export const Collections: React.FC = () => {
    const [data, setData] = useState<CardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof CardData; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        fetchCards();
    }, []);

    const fetchCards = async () => {
        setLoading(true);
        try {
            const { data: cards, error } = await supabase
                .from('ck_price_history')
                .select('id, collection, name, buy_usd, credit_usd, scraped_at');

            if (error) throw error;

            setData(cards || []);
        } catch (err: any) {
            console.error('Error fetching cards:', err);
            setError('Erro ao carregar dados. Verifique sua conexão ou as credenciais.');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof CardData) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = data.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.collection.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination Logic
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
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
                        placeholder="Buscar carta..."
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
                                        <th onClick={() => handleSort('collection')}>
                                            <div className="flex items-center gap-2">Coleção <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-2">Nome <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('buy_usd')}>
                                            <div className="flex items-center gap-2">Preço (USD) <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('credit_usd')}>
                                            <div className="flex items-center gap-2">Crédito (USD) <ArrowUpDown size={14} /></div>
                                        </th>
                                        <th onClick={() => handleSort('scraped_at')}>
                                            <div className="flex items-center gap-2">Data da cotação <ArrowUpDown size={14} /></div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.length > 0 ? (
                                        paginatedData.map((card) => (
                                            <tr key={card.id}>
                                                <td className="text-secondary">{card.collection}</td>
                                                <td className="font-bold">{card.name}</td>
                                                <td>{formatCurrency(card.buy_usd)}</td>
                                                <td>{formatCurrency(card.credit_usd)}</td>
                                                <td className="text-secondary">{formatDate(card.scraped_at)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                Nenhuma carta encontrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                                <span className="text-sm text-secondary">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <div className="flex gap-2">
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
