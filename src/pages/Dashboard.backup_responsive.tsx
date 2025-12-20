import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrendingUp, DollarSign, Layers } from 'lucide-react';
import { useTracking } from '../hooks/useTracking';
import { TrackButton } from '../components/TrackButton';

export const Dashboard: React.FC = () => {
    const [, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollections: 0,
        totalOpportunities: 0,
        usdRate: 0,
        eurRate: 0
    });
    const [topOpportunities, setTopOpportunities] = useState<any[]>([]);

    // Tracking
    const { trackedCardIds, trackedSetCodes, toggleTrackCard, toggleTrackSet } = useTracking();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Get Distinct Collections Count
            // Fetch all collections to count unique names client-side (or use a distinct query if supported)
            const { data: allCollections } = await supabase
                .from('cards')
                .select('set_name');

            let uniqueCollectionsCount = 0;
            if (allCollections) {
                const uniqueCollections = new Set(allCollections.map(item => item.set_name));
                uniqueCollectionsCount = uniqueCollections.size;
            }

            // 2. Get Opportunities Count (mock logic for now as variation_percentage is missing)
            // We'll just count cards with high buy price for now as a placeholder or 0
            const { count: oppCount } = await supabase
                .from('cards')
                .select('*', { count: 'exact', head: true })
                .gt('ck_buy_usd', 50); // Example threshold for "opportunity"

            // 3. Get Top Opportunities (Now Top Expensive Cards)
            const { data: opps } = await supabase
                .from('cards')
                .select('*')
                .order('ck_buy_usd', { ascending: false })
                .limit(5);

            // 4. Fetch Real-time Currency Rates from exchangerate-api.com
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
                // Uses fallback values if API fails
            }

            setStats({
                totalCollections: uniqueCollectionsCount,
                totalOpportunities: oppCount || 0,
                usdRate: usd,
                eurRate: eur
            });

            if (opps) setTopOpportunities(opps);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                            <Layers size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Coleções</p>
                            <p className="text-2xl font-bold">{stats.totalCollections}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Oportunidades</p>
                            <p className="text-2xl font-bold">{stats.totalOpportunities}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Dólar (USD)</p>
                            <p className="text-2xl font-bold">R$ {stats.usdRate.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-500">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Euro (EUR)</p>
                            <p className="text-2xl font-bold">R$ {stats.eurRate.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Opportunities Section */}
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold">Top Cartas (USD)</h2>
                    <button className="btn btn-secondary text-sm">Ver Todas</button>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Coleção</th>
                                <th>Nome</th>
                                <th>Preço (USD)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topOpportunities.length > 0 ? (
                                topOpportunities.map((item, index) => (
                                    <tr key={index} className="group hover:bg-gray-50">
                                        <td className="font-medium relative">
                                            <div className="flex items-center gap-2">
                                                {item.set_name}
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
                                        <td className="relative">
                                            <div className="flex items-center gap-2">
                                                {item.name}
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
                                        <td>${item.ck_buy_usd}</td>
                                        <td>
                                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-[rgba(48,209,88,0.1)] text-[var(--success)]">
                                                Alta
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-[var(--text-secondary)]">
                                        Nenhuma carta encontrada no momento.
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
