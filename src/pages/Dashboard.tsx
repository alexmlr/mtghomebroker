import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TrendingUp, DollarSign, Layers } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const [, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollections: 0,
        totalOpportunities: 0,
        usdRate: 0,
        eurRate: 0
    });
    const [topOpportunities, setTopOpportunities] = useState<any[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // 1. Get Distinct Collections Count
            // Fetch all collections to count unique names client-side (or use a distinct query if supported)
            const { data: allCollections } = await supabase
                .from('ck_price_history')
                .select('collection');

            let uniqueCollectionsCount = 0;
            if (allCollections) {
                const uniqueCollections = new Set(allCollections.map(item => item.collection));
                uniqueCollectionsCount = uniqueCollections.size;
            }

            // 2. Get Opportunities Count (mock logic for now)
            const { count: oppCount } = await supabase
                .from('ck_price_history')
                .select('*', { count: 'exact', head: true })
                .gt('variation_percentage', 0);

            // 3. Get Top Opportunities
            const { data: opps } = await supabase
                .from('ck_price_history')
                .select('*')
                .order('variation_percentage', { ascending: false })
                .limit(5);

            // 4. Mock Currency Rates (In a real app, fetch from an API)
            const usd = 5.05;
            const eur = 5.45;

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
                    <h2 className="text-lg font-bold">Top Oportunidades</h2>
                    <button className="btn btn-secondary text-sm">Ver Todas</button>
                </div >

    <div className="table-container">
        <table>
            <thead>
                <tr>
                    <th>Coleção</th>
                    <th>Preço (USD)</th>
                    <th>Variação (24h)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {topOpportunities.length > 0 ? (
                    topOpportunities.map((item, index) => (
                        <tr key={index}>
                            <td className="font-medium">{item.collection}</td>
                            <td>${item.price_usd}</td>
                            <td className={item.variation_percentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                                {item.variation_percentage > 0 ? '+' : ''}{item.variation_percentage}%
                            </td>
                            <td>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.variation_percentage >= 0
                                    ? 'bg-[rgba(48,209,88,0.1)] text-[var(--success)]'
                                    : 'bg-[rgba(255,69,58,0.1)] text-[var(--danger)]'
                                    }`}>
                                    {item.variation_percentage >= 0 ? 'Alta' : 'Baixa'}
                                </span>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={4} className="text-center py-8 text-[var(--text-secondary)]">
                            Nenhuma oportunidade encontrada no momento.
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
