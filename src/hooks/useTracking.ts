import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export const useTracking = () => {
    const { user } = useAuth();
    const [trackedCardIds, setTrackedCardIds] = useState<Set<number>>(new Set());
    const [trackedSetCodes, setTrackedSetCodes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    const fetchTrackedItems = useCallback(async () => {
        if (!user) return;
        try {
            const [cardsRes, setsRes] = await Promise.all([
                supabase.from('user_tracked_cards').select('card_id'),
                supabase.from('user_tracked_sets').select('set_code')
            ]);

            if (cardsRes.error) throw cardsRes.error;
            if (setsRes.error) throw setsRes.error;

            setTrackedCardIds(new Set(cardsRes.data.map(i => Number(i.card_id))));
            setTrackedSetCodes(new Set(setsRes.data.map(i => i.set_code)));
        } catch (error) {
            console.error('Error fetching tracked items:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTrackedItems();
    }, [fetchTrackedItems]);

    const toggleTrackCard = async (cardId: number) => {
        if (!user) {
            console.error("User not logged in");
            return { success: false, error: 'User not logged in' };
        }
        console.log(`Toggling card ${cardId} for user ${user.id}`);

        const isTracked = trackedCardIds.has(cardId);
        console.log(`Current state: ${isTracked ? 'Tracked' : 'Not Tracked'}`);

        // Optimistic update
        const newSet = new Set(trackedCardIds);
        if (isTracked) newSet.delete(cardId);
        else newSet.add(cardId);
        setTrackedCardIds(newSet);

        try {
            if (isTracked) {
                console.log("Attempting Delete for card:", cardId, "User:", user.id);
                // Explicitly selecting 'id' to confirm deletion
                const { error, data, count } = await supabase
                    .from('user_tracked_cards')
                    .delete({ count: 'exact' })
                    .eq('user_id', user.id)
                    .eq('card_id', cardId)
                    .select();

                console.log("Delete result - Error:", error, "Data:", data, "Count:", count);

                if (error) throw error;
                // If count is 0, it means RLS or filter prevented deletion
                if (count === 0) {
                    console.warn("Delete operation returned 0 rows affected. Possible RLS issue or record not found.");
                    // Consider throwing error to revert optimistic update?
                    // throw new Error("Delete failed (0 rows)");
                }
            } else {
                console.log("Attempting Insert...");
                const { error, data } = await supabase.from('user_tracked_cards').insert({ user_id: user.id, card_id: cardId }).select();
                if (error) throw error;
                console.log("Insert successful", data);
            }
            return { success: true };
        } catch (error: any) {
            console.error('Error toggling card track:', error);
            // Revert on error
            fetchTrackedItems();
            return { success: false, error };
        }
    };

    const toggleTrackSet = async (setCode: string) => {
        if (!user) return;
        const isTracked = trackedSetCodes.has(setCode);

        // Optimistic update
        const newSet = new Set(trackedSetCodes);
        if (isTracked) newSet.delete(setCode);
        else newSet.add(setCode);
        setTrackedSetCodes(newSet);

        try {
            if (isTracked) {
                await supabase.from('user_tracked_sets').delete().eq('user_id', user.id).eq('set_code', setCode);
            } else {
                await supabase.from('user_tracked_sets').insert({ user_id: user.id, set_code: setCode });
            }
        } catch (error) {
            console.error('Error toggling set track:', error);
            // Revert on error
            fetchTrackedItems();
        }
    };

    return {
        trackedCardIds,
        trackedSetCodes,
        toggleTrackCard,
        toggleTrackSet,
        loading
    };
};
