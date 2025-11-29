import React, { useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export const Profile: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (user) {
            getProfile();
        }
    }, [user]);

    const getProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', user!.id)
                .single();

            if (error) throw error;
            if (data) {
                setFullName(data.full_name || '');
                setAvatarUrl(data.avatar_url);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setLoading(true);
            setMessage(null);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Selecione uma imagem para enviar.');
            }

            const file = event.target.files[0];

            // Validate size (110KB = 110 * 1024 bytes)
            if (file.size > 110 * 1024) {
                throw new Error('A imagem deve ter no máximo 110KB.');
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${user!.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to 'profile-pictures' bucket
            const { error: uploadError } = await supabase.storage
                .from('profile-pictures')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(filePath);

            // Update Profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user!.id);

            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setMessage({ type: 'success', text: 'Foto de perfil atualizada!' });

        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            setMessage({ type: 'error', text: error.message || 'Erro ao atualizar foto.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', user!.id);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
            <div className="card">
                {message && (
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        backgroundColor: message.type === 'success' ? 'rgba(42, 157, 143, 0.1)' : 'rgba(239, 35, 60, 0.1)',
                        color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
                        border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`
                    }}>
                        {message.text}
                    </div>
                )}

                <div className="flex flex-col items-center gap-4 mb-6" style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '6rem',
                            height: '6rem',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '2px solid var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden'
                        }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                    {user?.email?.[0].toUpperCase() || 'U'}
                                </span>
                            )}
                        </div>
                        <label style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            padding: '0.5rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                            {loading ? <Loader2 size={16} className="animate-spin text-accent" /> : <Upload size={16} className="text-accent" />}
                            <input
                                type="file"
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                disabled={loading}
                            />
                        </label>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p className="text-xs text-secondary">Recomendado: 250x250px, Max 110KB</p>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="text-sm text-secondary">Nome Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="text-sm text-secondary">Email</label>
                            <input type="email" defaultValue={user?.email} disabled style={{ opacity: 0.7 }} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="text-sm text-secondary">Nova Senha</label>
                        <input type="password" placeholder="Deixe em branco para manter a atual" />
                    </div>

                    <div className="input-group">
                        <label className="text-sm text-secondary">Confirmar Nova Senha</label>
                        <input type="password" placeholder="Repita a nova senha" />
                    </div>

                    <div className="flex justify-between" style={{ justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem' }}>
                        <button type="button" className="btn btn-ghost">Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
