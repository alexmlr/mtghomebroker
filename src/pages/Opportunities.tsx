import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CardPreview } from '../components/CardPreview';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, DollarSign, RefreshCw, ArrowUpDown, Filter, Globe, List } from 'lucide-react';

// Types
interface OpportunityCard {
    id: number;
    name: string;
    set_name: string;
    set_code: string;
    collector_number_normalized: string;
    // Base Prices
    ck_buylist_usd: number;
    lm_sell_brl: number;
    tcgplayer_market_usd?: number;
    cardmarket_avg_eur?: number;
    liga_magic_url?: string;
    // Calculated fields (updated dynamically)
    revenue: number; // In selected currency
    profit: number;  // In selected currency
    roi_percentage: number;
    buy_at?: string;
    sell_at?: string;
}

type Currency = 'BRL' | 'USD' | 'EUR';

export const Opportunities: React.FC = () => {
    // Data State
    const [myCards, setMyCards] = useState<any[]>([]);
    const [globalCards, setGlobalCards] = useState<any[]>([]);
    const [opportunities, setOpportunities] = useState<OpportunityCard[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'my_list' | 'global'>('my_list');
    const [currency, setCurrency] = useState<Currency>('BRL');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'roi_percentage', direction: 'desc' });
    const [minProfitMargin, setMinProfitMargin] = useState<number>(0.20);

    // Exchange Rates
    const [rates, setRates] = useState<{ USDBRL: number; EURBRL: number } | null>(null);

    // Constants
    const FIXED_COST_BRL = 0.30; // Approx fixed cost per card handling

    useEffect(() => {
        fetchRates();
        fetchMyData();
        // We fetch global data only when tab changes to global to save bandwidth, or initial lazy load?
        // Let's lazy load global data.
    }, []);

    useEffect(() => {
        if (activeTab === 'global' && globalCards.length === 0) {
            fetchGlobalData();
        }
    }, [activeTab]);

    // Recalculate when dependencies change
    useEffect(() => {
        const sourceData = activeTab === 'my_list' ? myCards : globalCards;
        if (sourceData.length > 0 && rates) {
            processOpportunities(sourceData, rates, currency);
        } else if (sourceData.length === 0 && !loading) {
            setOpportunities([]);
        }
    }, [minProfitMargin, myCards, globalCards, rates, currency, sortConfig, activeTab]);

    const fetchRates = async () => {
        try {
            const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL');
            const data = await res.json();
            setRates({
                USDBRL: parseFloat(data.USDBRL.bid),
                EURBRL: parseFloat(data.EURBRL.bid)
            });
        } catch (err) {
            console.error("Error fetching rates", err);
        }
    };

    const fetchMyData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('my_tracked_cards_view')
                .select('*')
                .gt('lm_sell_brl', 0)
                .gt('ck_buylist_usd', 0);

            if (error) throw error;
            setMyCards(data || []);
        } catch (error) {
            console.error("Error fetching my cards:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGlobalData = async () => {
        setLoading(true);
        try {
            // Fetching a limit of items for now to avoid freezing browser.
            // Ideally this should be a view sorted by potential profit, but we can't easily sort by calculated ROI in standard SQL view without a function.
            // We'll fetch cards that have both prices.
            const { data, error } = await supabase
                .from('all_opportunities_view')
                .select('*')
                .gt('lm_sell_brl', 0)
                .gt('ck_buylist_usd', 0)
                .limit(1000); // Analyze top 1000 candidates with prices

            if (error) throw error;
            setGlobalCards(data || []);
        } catch (error) {
            console.error("Error fetching global cards:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Core Logic: Process & Convert ---
    const processOpportunities = (cards: any[], currentRates: { USDBRL: number; EURBRL: number }, selectedCurrency: Currency) => {
        const opps: OpportunityCard[] = [];
        const { USDBRL, EURBRL } = currentRates;

        // Currency Multipliers to convert FROM BRL TO Selected
        let rateToSelected = 1;
        if (selectedCurrency === 'USD') rateToSelected = 1 / USDBRL;
        if (selectedCurrency === 'EUR') rateToSelected = 1 / EURBRL;

        cards.forEach((card: any) => {
            const ckUsd = card.ck_buylist_usd;
            const lmBrl = card.lm_sell_brl;

            // 1. Unify everything to BRL first for calculation
            const revenueBrl = ckUsd * USDBRL;
            const costBrl = lmBrl + FIXED_COST_BRL; // Buying at LM -> Selling at CK usually

            const profitBrl = revenueBrl - costBrl;
            const roi = profitBrl / costBrl;

            // 2. Filter
            if (roi >= minProfitMargin) {
                // 3. Convert to Selected Currency
                opps.push({
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_code: card.set_code,
                    collector_number_normalized: card.collector_number_normalized,
                    ck_buylist_usd: ckUsd,
                    lm_sell_brl: lmBrl,
                    tcgplayer_market_usd: card.tcgplayer_market_usd,
                    cardmarket_avg_eur: card.cardmarket_avg_eur,
                    liga_magic_url: card.liga_magic_url,

                    revenue: revenueBrl * rateToSelected,
                    profit: profitBrl * rateToSelected,
                    roi_percentage: roi,

                    buy_at: 'LigaMagic', // Hardcoded flow for now: Buy LM -> Sell CK
                    sell_at: 'Card Kingdom'
                });
            }
        });

        // Sort
        opps.sort((a, b) => {
            const fieldA = (a as any)[sortConfig.key];
            const fieldB = (b as any)[sortConfig.key];
            if (sortConfig.direction === 'asc') return fieldA > fieldB ? 1 : -1;
            else return fieldA < fieldB ? 1 : -1;
        });

        setOpportunities(opps);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    // Formatters
    const fmt = (val: number) => {
        return new Intl.NumberFormat(
            selectedLang(currency),
            { style: 'currency', currency: currency }
        ).format(val);
    };

    // Helper for Locale
    const selectedLang = (curr: Currency) => {
        if (curr === 'BRL') return 'pt-BR';
        if (curr === 'EUR') return 'de-DE';
        return 'en-US';
    }

    const fmtPercent = (val: number) => (val * 100).toFixed(0) + '%';
    const fmtRoi = (val: number) => (val * 100).toFixed(1) + '%';

    const marginOptions = [0.20, 0.30, 0.40, 0.50];

    return (
        <div className="p-2 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                            <TrendingUp className="text-green-500" />
                            Oportunidades
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Encontre arbitragem entre lojas (Buy low, Sell high).
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        {/* Currency Selector */}
                        <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            {(['BRL', 'USD', 'EUR'] as Currency[]).map((cur) => (
                                <button
                                    key={cur}
                                    onClick={() => setCurrency(cur)}
                                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${currency === cur
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {cur}
                                </button>
                            ))}
                        </div>

                        {/* Profit Margin */}
                        <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm items-center">
                            <div className="px-3 py-1.5 border-r border-gray-200 dark:border-slate-700 text-xs text-gray-500 bg-gray-50 dark:bg-slate-900 flex items-center gap-1">
                                <Filter size={12} /> <span className="hidden sm:inline">Lucro</span>
                            </div>
                            {marginOptions.map((margin) => (
                                <button
                                    key={margin}
                                    onClick={() => setMinProfitMargin(margin)}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${minProfitMargin === margin
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {fmtPercent(margin)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rates Ticker */}
                {rates && (
                    <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/50 p-2 rounded-md w-fit">
                        <span className="flex items-center gap-1">
                            <DollarSign size={10} /> 1 USD = <b>R$ {rates.USDBRL.toFixed(2)}</b>
                        </span>
                        <div className="w-px h-full bg-gray-300 dark:bg-slate-700"></div>
                        <span className="flex items-center gap-1">
                            <span className="font-serif">€</span> 1 EUR = <b>R$ {rates.EURBRL.toFixed(2)}</b>
                        </span>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab('my_list')}
                    className={`pb-3 px-1 text-sm font-medium flex items-center gap-2 transition-all relative ${activeTab === 'my_list'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <List size={16} />
                    Minha Lista
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs ml-1">
                        {myCards.length > 0 ? myCards.length : '-'}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('global')}
                    className={`pb-3 px-1 text-sm font-medium flex items-center gap-2 transition-all relative ${activeTab === 'global'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Globe size={16} />
                    Todas as Cartas (Global)
                    {/* Badge only shows count if loaded */}
                    {globalCards.length > 0 && (
                        <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full text-xs ml-1">
                            {globalCards.length > 999 ? '999+' : globalCards.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Disclaimer */}
            {activeTab === 'global' && (
                <div className="mb-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900 rounded-lg p-3 text-sm text-purple-800 dark:text-purple-200 flex items-start gap-2">
                    <Globe size={16} className="shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold">Modo Global:</span> O sistema está analisando todas as cartas do banco de dados para encontrar oportunidades, mesmo as que você não segue.
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                        <RefreshCw className="animate-spin mb-2" size={24} />
                        <span className="text-sm">Buscando melhores oportunidades...</span>
                    </div>
                ) : opportunities.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <TrendingUp size={32} className="mx-auto mb-3 opacity-20" />
                        <h3 className="text-lg font-medium">Nenhuma oportunidade encontrada</h3>
                        <p className="text-sm mt-1 max-w-md mx-auto">
                            Tente reduzir a margem de lucro mínima ou adicione mais cartas à sua lista.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th onClick={() => handleSort('name')} className="px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                                        <div className="flex items-center gap-1">Carta <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('lm_sell_brl')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                                        <div className="flex items-center justify-end gap-1">Compra <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('revenue')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                                        <div className="flex items-center justify-end gap-1">Venda <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('profit')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700">
                                        <div className="flex items-center justify-end gap-1">Lucro Est. <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th onClick={() => handleSort('roi_percentage')} className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 bg-green-50/50 dark:bg-green-900/10">
                                        <div className="flex items-center justify-end gap-1">ROI <ArrowUpDown size={10} /></div>
                                    </th>
                                    <th className="px-4 py-3 text-center">Links</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                {opportunities.map((opp) => (
                                    <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <CardPreview set_code={opp.set_code} collector_number={opp.collector_number_normalized}>
                                                    <div className="h-10 w-10 md:w-8 md:h-12 bg-gray-100 dark:bg-slate-700 rounded flex items-center justify-center text-[8px] text-gray-400">
                                                        IMG
                                                    </div>
                                                </CardPreview>
                                                <div>
                                                    <Link to={`/carta/${opp.id}`} className="font-bold text-gray-900 dark:text-white text-sm hover:text-blue-500 line-clamp-1">
                                                        {opp.name}
                                                    </Link>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                                        <span className={`px-1 rounded text-[10px] uppercase font-bold text-white ${opp.set_code.length > 3 ? 'text-[8px]' : ''
                                                            }`} style={{ backgroundColor: '#6b7280' }}>
                                                            {opp.set_code}
                                                        </span>
                                                        <span className="truncate max-w-[120px]">{opp.set_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {/* Logic to show accurate buy price converted */}
                                                {/* For now we assume Buy is always LM (BRL) converted to selected currency */}
                                                {new Intl.NumberFormat(selectedLang(currency), { style: 'currency', currency: currency }).format(
                                                    opp.lm_sell_brl * (currency === 'BRL' ? 1 : currency === 'USD' ? (1 / (rates?.USDBRL || 1)) : (1 / (rates?.EURBRL || 1)))
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                via {opp.buy_at}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                {fmt(opp.revenue)}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                via {opp.sell_at}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                +{fmt(opp.profit)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap bg-green-50/30 dark:bg-green-900/5">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                {fmtRoi(opp.roi_percentage)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {opp.liga_magic_url && (
                                                <a
                                                    href={opp.liga_magic_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

