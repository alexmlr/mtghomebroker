import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import {
    ArrowLeft,
    ExternalLink,
    TrendingUp,
    Info,
    Share2,
    PlusCircle,
    Eye,
    Loader2
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

interface CardDetailsData {
    id: number;
    name: string;
    set_name: string;
    set_code: string;
    collector_number: string;
    link_ck: string;
    link_lm: string;
    image_url: string;
    is_foil: boolean;
    ck_buy_usd: number;
    lm_sell_brl: number;
    mtgjson_uuid?: string;
}

interface PriceHistory {
    scraped_at: string;
    price_brl: number;
    source: string;
}

export const CardDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [card, setCard] = useState<CardDetailsData | null>(null);
    const [history, setHistory] = useState<PriceHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [priceSource, setPriceSource] = useState<'CardKingdom' | 'LigaMagic'>('CardKingdom');
    const [scryfallData, setScryfallData] = useState<any>(null);
    const [lang, setLang] = useState<'en' | 'pt'>('en');

    useEffect(() => {
        if (id) {
            fetchCardDetails();
            fetchPriceHistory();
        }
    }, [id]);

    useEffect(() => {
        if (card) {
            fetchScryfallData(lang);
        }
    }, [card, lang]);

    const fetchCardDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('all_cards_with_prices')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setCard(data);
        } catch (err) {
            console.error('Error fetching card details:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchScryfallData = async (language: string) => {
        if (!card) return;
        try {
            // Try to fetch specific language
            const query = `!"${card.name}" set:${card.set_code} lang:${language}`;
            const sfRes = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
            const sfData = await sfRes.json();

            if (sfData.data && sfData.data.length > 0) {
                setScryfallData(sfData.data[0]);
            } else if (language === 'pt') {
                setLang('en');
            }
        } catch (err) {
            console.error('Error fetching scryfall data:', err);
        }
    };

    const fetchPriceHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('price_history')
                .select('scraped_at, price_brl, source')
                .eq('card_id', id)
                .order('scraped_at', { ascending: true });

            if (error) throw error;
            setHistory(data || []);
        } catch (err) {
            console.error('Error fetching price history:', err);
        }
    };

    // New: Fetch Market Prices from card_prices table
    const [marketPrices, setMarketPrices] = useState<any>(null);
    useEffect(() => {
        const fetchMarketPrices = async () => {
            if (!card?.mtgjson_uuid) return;
            try {
                const { data } = await supabase
                    .from('card_prices')
                    .select('*')
                    .eq('mtgjson_uuid', card.mtgjson_uuid)
                    .maybeSingle();

                if (data) setMarketPrices(data);
            } catch (err) {
                console.error("Error fetching market prices:", err);
            }
        };
        if (card) fetchMarketPrices();
    }, [card]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
                <p className="text-secondary">Carregando detalhes da carta...</p>
            </div>
        );
    }

    if (!card) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-800">Carta não encontrada</h2>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 btn btn-primary"
                >
                    Voltar
                </button>
            </div>
        );
    }

    const filteredHistory = history
        .filter(h => h.source === priceSource)
        .map(h => ({
            date: format(new Date(h.scraped_at), 'dd/MM'),
            price: h.price_brl
        }));

    // Help render mana symbols
    const renderManaSymbols = (manaCost: string) => {
        if (!manaCost) return null;
        const symbols = manaCost.match(/\{[^}]+\}/g) || [];
        return symbols.map((symbol, i) => {
            const cleanSymbol = symbol.replace(/\{|\}/g, '').replace('/', '');
            return (
                <img
                    key={i}
                    src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`}
                    alt={symbol}
                    className="w-5 h-5 inline-block mr-1"
                />
            );
        });
    };

    return (
        <div className="max-w-6xl mx-auto px-2 md:px-4 pb-20 md:pb-8">
            {/* Header / Breadcrumb */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-3 text-sm"
            >
                <ArrowLeft size={16} /> Voltar
            </button>

            <div className="flex flex-col gap-4">
                {/* Top Section: Title and Set */}
                <div>
                    <h1 className="text-2xl md:text-4xl font-extrabold text-[var(--text-primary)] mb-0.5 leading-tight">{card.name}</h1>
                    <div className="flex items-center gap-2 text-sm md:text-lg text-gray-400">
                        <span className="font-medium truncate max-w-[200px] md:max-w-none">{card.set_name}</span>
                        <span className="text-gray-600">•</span>
                        <span>#{card.collector_number}</span>
                        {card.is_foil && (
                            <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                Foil
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content Grid: Image & Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Left Layer: Image and Buttons */}
                    <div className="lg:col-span-4 flex flex-col gap-3">
                        <div className="card p-0 bg-transparent shadow-none border-none w-full mx-auto lg:mx-0 overflow-hidden md:max-w-[320px]">
                            <img
                                src={card.image_url || scryfallData?.image_uris?.normal || scryfallData?.image_uris?.large || 'https://placeholder.com/336x468?text=Imagem+indispon%C3%ADvel'}
                                alt={card.name}
                                className="w-full rounded-xl shadow-2xl transform transition-all hover:skew-y-0 duration-500"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 w-full mx-auto lg:mx-0 md:max-w-[320px]">
                            <button className="btn btn-ghost border border-gray-700 shadow-sm flex flex-col items-center py-1.5 h-auto" disabled>
                                <Eye size={16} className="mb-0.5 text-blue-500" />
                                <span className="text-[8px] uppercase font-bold text-gray-400">Watch</span>
                            </button>
                            <button className="btn btn-ghost border border-gray-700 shadow-sm flex flex-col items-center py-1.5 h-auto" disabled>
                                <PlusCircle size={16} className="mb-0.5 text-green-500" />
                                <span className="text-[8px] uppercase font-bold text-gray-400">Add</span>
                            </button>
                            <button className="btn btn-ghost border border-gray-700 shadow-sm flex flex-col items-center py-1.5 h-auto" disabled>
                                <Share2 size={16} className="mb-0.5 text-purple-500" />
                                <span className="text-[8px] uppercase font-bold text-gray-400">Share</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Layer: Chart */}
                    <div className="lg:col-span-8 mb-4">
                        <div className="card h-full flex flex-col bg-white dark:bg-slate-900 border-none p-3 md:p-6 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-base md:text-lg flex items-center gap-2 text-[var(--text-primary)]">
                                    <TrendingUp size={16} className="text-blue-500" />
                                    Histórico
                                </h3>

                                <select
                                    className="input py-0.5 px-2 text-[10px] md:text-xs bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-300 rounded-md"
                                    value={priceSource}
                                    onChange={(e) => setPriceSource(e.target.value as any)}
                                >
                                    <option value="CardKingdom">CardKingdom</option>
                                    <option value="LigaMagic">LigaMagic</option>
                                </select>
                            </div>

                            <div className="h-[300px] w-full">
                                {filteredHistory.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={filteredHistory}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 10 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 10 }}
                                                tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                                width={80}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="price"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={{ fill: '#3b82f6', strokeWidth: 1, r: 3, stroke: '#0f172a' }}
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                isAnimationActive={false}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                                cursor={{ stroke: '#64748b', strokeWidth: 1 }}
                                                formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-800 text-xs">
                                        <Info size={24} className="mb-2 opacity-30" />
                                        <p>Sem dados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Market Prices Card */}
            <div className="card bg-white dark:bg-slate-900 border-none mb-4 p-4 rounded-2xl">
                <h3 className="font-bold text-base md:text-lg mb-3 border-b border-gray-200 dark:border-slate-800 pb-2 text-[var(--text-primary)] flex items-center gap-2">
                    <span className="text-emerald-500">$</span> Cotações (Hoje)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* CK Buylist USD */}
                    {/* CK Buylist USD */}
                    <div className="bg-[var(--inner-bg)] p-3 rounded-xl border border-[var(--inner-border)]">
                        <h4 className="text-gray-500 dark:text-gray-400 text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5">CK (Cash)</h4>
                        <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                            {marketPrices?.ck_buylist_usd ?
                                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(marketPrices.ck_buylist_usd) :
                                <span className="text-gray-400 dark:text-gray-600 text-base">---</span>
                            }
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">USD</div>
                    </div>

                    {/* CK Buylist Credit */}
                    {/* CK Buylist Credit */}
                    <div className="bg-[var(--inner-bg)] p-3 rounded-xl border border-[var(--inner-border)]">
                        <h4 className="text-gray-500 dark:text-gray-400 text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5">CK (Credit)</h4>
                        <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                            {marketPrices?.ck_buylist_credit ?
                                new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(marketPrices.ck_buylist_credit) :
                                <span className="text-gray-400 dark:text-gray-600 text-base">---</span>
                            }
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">+30%</div>
                    </div>

                    {/* LigaMagic Sell */}
                    {/* LigaMagic Sell */}
                    <div className="bg-[var(--inner-bg)] p-3 rounded-xl border border-[var(--inner-border)] col-span-2 md:col-span-1">
                        <h4 className="text-gray-500 dark:text-gray-400 text-[9px] md:text-xs font-bold uppercase tracking-wider mb-0.5">LigaMagic</h4>
                        <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                            {card.lm_sell_brl ?
                                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.lm_sell_brl) :
                                <span className="text-gray-400 dark:text-gray-600 text-base">---</span>
                            }
                        </div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">BRL (Venda)</div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Scryfall Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <div className="card bg-white dark:bg-slate-900 border-none p-4">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-slate-800 pb-2">
                        <h3 className="font-bold text-lg text-[var(--text-primary)]">Efeito / Texto</h3>
                        <div className="flex gap-1 bg-[var(--inner-bg)] p-0.5 rounded-lg">
                            <button
                                onClick={() => setLang('en')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLang('pt')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${lang === 'pt' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                PT
                            </button>
                        </div>
                    </div>
                    {scryfallData ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-gray-500 dark:text-gray-400 text-sm italic">Custo de Mana:</span>
                                <div className="flex items-center">
                                    {renderManaSymbols(scryfallData.mana_cost)}
                                </div>
                            </div>
                            <div className="p-4 bg-[var(--inner-bg)] rounded-xl border border-[var(--inner-border)] text-[var(--inner-text)] whitespace-pre-wrap leading-relaxed">
                                {lang === 'pt' ? (scryfallData.printed_text || scryfallData.oracle_text) : scryfallData.oracle_text || 'Sem texto disponível.'}
                            </div>
                            {lang === 'pt' && !scryfallData.printed_text && (
                                <p className="text-[10px] text-amber-500/70 italic px-1 text-center font-medium">
                                    * Texto em português indisponível para esta edição no Scryfall. Exibindo versão original.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic py-8 text-center">Buscando informações no Scryfall...</p>
                    )}
                </div>

                <div className="card bg-white dark:bg-slate-900 border-none p-4">
                    <h3 className="font-bold text-lg mb-4 border-b border-gray-200 dark:border-slate-800 pb-2 text-[var(--text-primary)]">Links Oficiais</h3>
                    <div className="space-y-3">
                        {card.link_ck && (
                            <a
                                href={card.link_ck}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-[var(--inner-bg)] border border-[var(--inner-border)] rounded-xl hover:brightness-110 transition-all group"
                            >
                                <span className="font-medium text-gray-700 dark:text-gray-300">Card Kingdom (Buylist)</span>
                                <ExternalLink size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-400" />
                            </a>
                        )}
                        {card.link_lm && (
                            <a
                                href={card.link_lm}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 bg-[var(--inner-bg)] border border-[var(--inner-border)] rounded-xl hover:brightness-110 transition-all group"
                            >
                                <span className="font-medium text-gray-700 dark:text-gray-300">LigaMagic (Venda)</span>
                                <ExternalLink size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-400" />
                            </a>
                        )}
                        <a
                            href={`https://scryfall.com/card/${card.set_code}/${card.collector_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-[var(--inner-bg)] border border-[var(--inner-border)] rounded-xl hover:brightness-110 transition-all group"
                        >
                            <span className="font-medium text-gray-700 dark:text-gray-300">Scryfall</span>
                            <ExternalLink size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-blue-400" />
                        </a>
                    </div>
                </div>
            </div>
        </div >
    );
};
