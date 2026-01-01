import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrendingUp, DollarSign, Layers, ChevronRight } from 'lucide-react';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
    const [, setLoading] = useState(true);
    const [stats, setStats] = useState({
        usdRate: 0,
        eurRate: 0
    });
    const [opportunityCount, setOpportunityCount] = useState(0);
    const [trackedCardsSummary, setTrackedCardsSummary] = useState<any[]>([]);

    // Tracking
    const { trackedCardIds, trackedSetCodes, toggleTrackCard, toggleTrackSet } = useTracking();

    useEffect(() => {
        fetchDashboardData();
    }, [trackedCardIds]); // Re-fetch if tracked cards change

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Real-time Currency Rates
            let usd = 5.34;  // Fallback value
            let eur = 6.19;  // Fallback value

            try {
                // Fetch USD -> BRL
                const usdResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                const usdData = await usdResponse.json();
                if (usdData.rates && usdData.rates.BRL) {
                    usd = usdData.rates.BRL;
                }

                // Fetch EUR -> BRL
                const eurResponse = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                const eurData = await eurResponse.json();
                if (eurData.rates && eurData.rates.BRL) {
                    eur = eurData.rates.BRL;
                }
            } catch (error) {
                console.error('Error fetching exchange rates:', error);
            }

            setStats({
                usdRate: usd,
                eurRate: eur
            });

            // 2. Fetch Tracked Cards for Opportunities & Summary
            const { data: cards } = await supabase
                .from('my_tracked_cards_view')
                .select('*');

            if (cards) {
                // Calculate Opportunities (ROI >= 20%)
                let oppCount = 0;
                cards.forEach(item => {
                    const ckUsd = item.ck_buylist_usd || 0;
                    const lmBrl = item.lm_sell_brl || 0;
                    if (ckUsd > 0 && lmBrl > 0) {
                        const revenue = (ckUsd * usd) - 0.30;
                        const profit = revenue - lmBrl;
                        const roi = profit / lmBrl;
                        if (roi >= 0.20 && profit > 0.01) oppCount++;
                    }
                });
                setOpportunityCount(oppCount);

                // Prepare Summary Table (Top 5 Most Expensive Tracked Cards)
                // Filter out cards with 0 price if possible, or just sort all
                const sorted = [...cards]
                    .sort((a, b) => (b.ck_buylist_usd || 0) - (a.ck_buylist_usd || 0))
                    .slice(0, 5);
                setTrackedCardsSummary(sorted);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                <div className="card p-2 md:p-6">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-500 shrink-0">
                            <Layers size={16} />
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <p className="text-[9px] md:text-sm text-[var(--text-secondary)] truncate leading-tight">Coleções Monitoradas</p>
                            <p className="text-sm md:text-2xl font-bold truncate leading-tight">{trackedSetCodes.size}</p>
                        </div>
                    </div>
                </div>
                <div className="card p-2 md:p-6">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/10 rounded-md text-green-500 shrink-0">
                            <TrendingUp size={16} />
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <p className="text-[9px] md:text-sm text-[var(--text-secondary)] truncate leading-tight">Oportunidades</p>
                            <p className="text-sm md:text-2xl font-bold truncate leading-tight">{opportunityCount}</p>
                        </div>
                    </div>
                </div>
                <div className="card p-2 md:p-6">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/10 rounded-md text-purple-500 shrink-0">
                            <DollarSign size={16} />
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <p className="text-[9px] md:text-sm text-[var(--text-secondary)] truncate leading-tight">Dólar (USD)</p>
                            <p className="text-sm md:text-2xl font-bold truncate leading-tight">R$ {stats.usdRate.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="card p-2 md:p-6">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/10 rounded-md text-indigo-500 shrink-0">
                            <DollarSign size={16} />
                        </div>
                        <div className="overflow-hidden min-w-0">
                            <p className="text-[9px] md:text-sm text-[var(--text-secondary)] truncate leading-tight">Euro (EUR)</p>
                            <p className="text-sm md:text-2xl font-bold truncate leading-tight">R$ {stats.eurRate.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tracked Cards Summary Section */}
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm md:text-base font-bold uppercase tracking-wide">Cards que eu acompanho</h2>
                    <Link to="/minha-lista" className="btn btn-secondary p-1.5 rounded-lg" title="Ver Minha Lista">
                        <ChevronRight size={16} />
                    </Link>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th className="text-[10px] md:text-xs">Coleção</th>
                                <th className="text-[10px] md:text-xs">Nome</th>
                                <th className="text-[10px] md:text-xs text-right">Compra (LM)</th>
                                <th className="text-[10px] md:text-xs text-right">Venda (CK)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trackedCardsSummary.length > 0 ? (
                                trackedCardsSummary.map((item, index) => (
                                    <tr key={index} className="group hover:bg-gray-50 cursor-pointer">
                                        <td className="font-medium relative text-xs md:text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate max-w-[80px] md:max-w-[150px]">{item.set_name}</span>
                                                <TrackButton
                                                    type="set"
                                                    isTracked={trackedSetCodes.has(item.set_code)}
                                                    onToggle={(e) => {
                                                        e.stopPropagation();
                                                        toggleTrackSet(item.set_code);
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="relative text-xs md:text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate max-w-[100px] md:max-w-[200px]" title={item.name}>{item.name}</span>
                                                <TrackButton
                                                    type="card"
                                                    isTracked={trackedCardIds.has(item.id)}
                                                    onToggle={(e) => {
                                                        e.stopPropagation();
                                                        toggleTrackCard(item.id);
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="text-xs md:text-sm text-right">
                                            {item.lm_sell_brl > 0 ? formatBRL(item.lm_sell_brl) : '-'}
                                        </td>
                                        <td className="text-xs md:text-sm text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>${item.ck_buylist_usd?.toFixed(2) || '0.00'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-[var(--text-secondary)] text-sm">
                                        Você ainda não está monitorando nenhuma carta.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
        </div >
    );
};
