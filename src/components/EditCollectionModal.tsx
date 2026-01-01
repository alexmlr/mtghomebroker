import React, { useEffect, useState } from 'react';
import { X, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getScryfallImageUrl } from '../lib/scryfall';

interface EditCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalCard: {
        id: number;
        name: string;
        set_code: string;
        set_name: string;
        collector_number: string;
    } | null;
    onSuccess: () => void;
}

interface CardVariant {
    id: number;
    set_code: string;
    set_name: string;
    collector_number: string;
    image_url?: string;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({ isOpen, onClose, originalCard, onSuccess }) => {
    const [variants, setVariants] = useState<CardVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && originalCard) {
            fetchVariants();
            setSelectedVariantId(originalCard.id);
        } else {
            setVariants([]);
            setPreviewImage(null);
        }
    }, [isOpen, originalCard]);

    // Fetch image when selected variant changes
    useEffect(() => {
        const fetchImage = async () => {
            const variant = variants.find(v => v.id === selectedVariantId);
            if (variant) {
                const url = await getScryfallImageUrl(variant.set_code, variant.collector_number);
                setPreviewImage(url);
            } else {
                setPreviewImage(null);
            }
        };
        fetchImage();
    }, [selectedVariantId, variants]);

    // ... fetchVariants ...

    // ... render ...



    const fetchVariants = async () => {
        if (!originalCard) return;
        setLoading(true);
        try {


            // Fetch all cards with same name using the view that contains set names
            // Using ilike for case-insensitive matching which is safer
            const { data, error } = await supabase
                .from('all_cards_with_prices')
                .select('id, set_code, set_name, collector_number')
                .ilike('name', originalCard.name)
                .order('set_name', { ascending: true });

            if (!error && data) {
                setVariants(data);
                if (data.length === 0) {
                    console.warn("No variants found for:", originalCard.name);
                }
            }
        } catch (err) {
            console.error("Error fetching variants", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!originalCard || !selectedVariantId || selectedVariantId === originalCard.id) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            const userRes = await supabase.auth.getUser();
            const userId = userRes.data.user?.id;

            if (userId) {
                // Transaction-like: Delete old, Insert new
                // Supabase doesn't do strict transactions via client easily without RPC, 
                // but we can do sequential.

                // 1. Delete Old
                const { error: delErr } = await supabase
                    .from('user_tracked_cards')
                    .delete()
                    .match({ user_id: userId, card_id: originalCard.id });

                if (delErr) throw delErr;

                // 2. Insert New
                const { error: insErr } = await supabase
                    .from('user_tracked_cards')
                    .insert({ user_id: userId, card_id: selectedVariantId });

                if (insErr) throw insErr;

                onSuccess();
                onClose();
            }
        } catch (err) {
            console.error("Error updating tracking", err);
            alert("Erro ao atualizar coleção.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !originalCard) return null;



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold">Alterar Coleção</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Carta: <span className="text-gray-900 dark:text-white font-bold">{originalCard.name}</span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecione a Edição</label>
                            {variants.length > 0 ? (
                                <select
                                    className="w-full input p-2 rounded-lg bg-[var(--inner-bg)] border border-[var(--inner-border)]"
                                    value={selectedVariantId || ''}
                                    onChange={(e) => setSelectedVariantId(Number(e.target.value))}
                                >
                                    {variants.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.set_name} ({v.set_code.toUpperCase()}) - #{v.collector_number}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 text-sm text-center text-gray-500">
                                    Nenhuma outra edição encontrada para esta carta.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Image Preview */}
                    {previewImage && (
                        <div className="flex justify-center">
                            <img
                                src={previewImage}
                                alt="Preview"
                                className="h-48 rounded-lg shadow-md object-contain"
                            />
                        </div>
                    )}

                    {/* Warning */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-3 rounded-xl flex gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-xs text-amber-700 dark:text-amber-500 leading-tight">
                            <strong>Atenção:</strong> Ao trocar a edição, o link da LigaMagic <strong>não</strong> será atualizado automaticamente. Você precisará verificar/atualizar o link manualmente se estiver rastreando o preço na LigaMagic.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading || selectedVariantId === originalCard.id}
                        className="px-6 py-2 btn btn-primary flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar Alteração
                    </button>
                </div>
            </div>
        </div>
    );
};
