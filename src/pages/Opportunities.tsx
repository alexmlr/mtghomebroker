import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CardPreview } from '../components/CardPreview';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, DollarSign, AlertCircle, RefreshCw, ArrowUpDown, Filter } from 'lucide-react';
// import { useTracking } from '../hooks/useTracking';

interface OpportunityCard {
    id: number;
    name: string;
    set_name: string;
    set_code: string;
    collector_number_normalized: string;
    ck_buylist_usd: number;
    lm_sell_brl: number;
    liga_magic_url?: string;
    // Calculated fields
    revenue_brl: number;
    profit_brl: number;
    roi_percentage: number;
}

export const Opportunities: React.FC = () => {
    const [rawCards, setRawCards] = useState<any[]>([]);
    const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    // const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'roi_percentage', direction: 'desc' });
    const [minProfitMargin, setMinProfitMargin] = useState<number>(0.50); // Default 50%

    // Constants
    const FIXED_COST_BRL = 0.30;

    useEffect(() => {
        fetchData();
    }, []);

    // Recalculate when margin or raw data changes (client-side filtering)
    useEffect(() => {
        if (rawCards.length > 0 && exchangeRate) {
            processOpportunities(rawCards, exchangeRate);
        } else if (rawCards.length === 0 && !loading) {
            // If rawCards is empty and not loading, clear opportunities
            setOpportunities([]);
        }
    }, [minProfitMargin, rawCards, exchangeRate, sortConfig.key, sortConfig.direction]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Exchange Rate
            const rateResponse = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
            const rateData = await rateResponse.json();
            const currentRate = parseFloat(rateData.USDBRL.bid);
            setExchangeRate(currentRate);
            // setLastUpdated(new Date());

            // 2. Fetch Tracked Cards
            // We use the view 'my_tracked_cards_view' which already filters for user's tracked items
            const { data: cards, error } = await supabase
                .from('my_tracked_cards_view')
                .select('*')
                .gt('lm_sell_brl', 0)
                .gt('ck_buylist_usd', 0);

            if (error) throw error;

            if (cards) {
                setRawCards(cards); // Store raw data for quick re-filtering
                // Processing happens in the useEffect hook
            }

        } catch (error) {
            console.error("Error fetching opportunities:", error);
        } finally {
            setLoading(false);
        }
    };

    const processOpportunities = (cards: any[], rate: number) => {
        const opps: OpportunityCard[] = [];

        cards.forEach((card: any) => {
            const ckUsd = card.ck_buylist_usd;
            const lmBrl = card.lm_sell_brl;

            // Calculation Logic
            // Convert USD revenue to BRL
            const convertedRevenue = ckUsd * rate;

            // Subtract fixed cost (0.30 R$)
            const finalRevenue = convertedRevenue - FIXED_COST_BRL;

            // Calculate Profit
            const profit = finalRevenue - lmBrl;

            // Calculate ROI
            const roi = profit / lmBrl;

            // Dynamic Filter based on State
            if (roi >= minProfitMargin) {
                opps.push({
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_code: card.set_code,
                    collector_number_normalized: card.collector_number_normalized,
                    ck_buylist_usd: ckUsd,
                    lm_sell_brl: lmBrl,
                    liga_magic_url: card.liga_magic_url,
                    revenue_brl: finalRevenue,
                    profit_brl: profit,
                    roi_percentage: roi
                });
            }
        });

        // Maintain current sort
        sortOps(opps, sortConfig.key, sortConfig.direction);
        setOpportunities(opps);
    };

    const sortOps = (data: OpportunityCard[], key: string, direction: 'asc' | 'desc') => {
        data.sort((a, b) => {
            const fieldA = (a as any)[key];
            const fieldB = (b as any)[key];
            if (direction === 'asc') return fieldA > fieldB ? 1 : -1;
            else return fieldA < fieldB ? 1 : -1;
        });
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc'; // Default to desc for opportunities generally
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';

        setSortConfig({ key, direction });
        // The useEffect for recalculating opportunities will handle the actual sorting
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatPercent = (val: number) => (val * 100).toFixed(0) + '%';
    const formatRoi = (val: number) => (val * 100).toFixed(1) + '%';

    const marginOptions = [0.20, 0.30, 0.40, 0.50];

    return (
        <div className="p-2 md:p-6 max-w-7xl mx-auto">
            {/* Header / Summary */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <TrendingUp className="text-green-500" />
                            Oportunidades de Arbitragem
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Cartas da sua lista com lucro potencial.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Profit Margin Selector */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 border-r border-gray-200 text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <Filter size={14} />
                                Lucro Mínimo
                            </div>
                            <div className="flex">
                                {marginOptions.map((margin) => (
                                    <button
                                        key={margin}
                                        onClick={() => setMinProfitMargin(margin)}
                                        className={`px-3 py-2 text-xs font-medium transition-colors ${minProfitMargin === margin
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {formatPercent(margin)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {exchangeRate && (
                            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-1.5 text-gray-600">
                                    <DollarSign size={16} />
                                    <span>Cotação USD: <b>R$ {exchangeRate.toFixed(4)}</b></span>
                                </div>
                                <div className="w-px h-4 bg-gray-200"></div>
                                <button onClick={fetchData} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                    Atualizar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold">Como é calculado:</span> (Preço CardKingdom (USD) × Cotação) - R$ 0,30 (Taxa) - Preço LigaMagic (BRL) = Lucro Estimado.
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading && opportunities.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                    <RefreshCw className="animate-spin text-gray-400" size={32} />
                </div>
            ) : opportunities.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="text-gray-300" size={24} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Nenhuma oportunidade encontrada</h3>
                    <p className="text-gray-500 max-w-md mx-auto mt-2">
                        No momento, nenhuma das suas cartas atende ao critério de {formatPercent(minProfitMargin)} de lucro.
                        Tente reduzir a margem ou monitore mais cartas.
                    </p>
                    <Link to="/minha-lista" className="inline-block mt-4 text-blue-600 hover:underline">
                        Ir para Minha Lista
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th onClick={() => handleSort('name')} className="px-4 py-3 cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center gap-1">Carta <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('lm_sell_brl')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center justify-end gap-1">Compra (LM) <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('revenue_brl')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center justify-end gap-1">Venda Liq. (CK) <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('profit_brl')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100">
                                        <div className="flex items-center justify-end gap-1">Lucro <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('roi_percentage')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 bg-green-50/50">
                                        <div className="flex items-center justify-end gap-1">ROI <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-center">Links</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {opportunities.map((opp) => (
                                    <tr key={opp.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <CardPreview set_code={opp.set_code} collector_number={opp.collector_number_normalized}>
                                                    <div className="w-8 h-12 bg-gray-200 rounded overflow-hidden shadow-sm flex-shrink-0 relative group">
                                                        {/* Image Placeholder - relying on CardPreview on hover, or we could add an img tag here if we had the url logic handy */}
                                                        <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">IMG</div>
                                                    </div>
                                                </CardPreview>
                                                <div>
                                                    <div className="font-medium text-gray-900 text-sm line-clamp-1" title={opp.name}>{opp.name}</div>
                                                    <div className="text-xs text-gray-500">{opp.set_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-700">{formatBRL(opp.lm_sell_brl)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-700">{formatBRL(opp.revenue_brl)}</div>
                                            <div className="text-xs text-gray-400">
                                                {formatUSD(opp.ck_buylist_usd)} (Bruto)
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-bold text-green-600">+{formatBRL(opp.profit_brl)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap bg-green-50/30">
                                            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                {formatRoi(opp.roi_percentage)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {opp.liga_magic_url && (
                                                    <a href={opp.liga_magic_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="Ver na LigaMagic">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
