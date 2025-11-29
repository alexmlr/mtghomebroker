import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Edit, Plus, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: 'admin' | 'subscriber';
    avatar_url: string | null;
}

export const Settings: React.FC = () => {
    const { role: currentUserRole } = useAuth();
    const [logo, setLogo] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // Footer Text State
    const [footerText, setFooterText] = useState('');
    const [savingFooter, setSavingFooter] = useState(false);

    // Users State
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

    useEffect(() => {
        if (currentUserRole === 'admin') {
            fetchUsers();
            fetchSystemSettings();
        }
    }, [currentUserRole]);

    const fetchSystemSettings = async () => {
        try {
            // Fetch Logo
            const { data: files } = await supabase.storage.from('branding').list('system');
            if (files && files.length > 0) {
                const logoFile = files.find(f => f.name.startsWith('logo.'));
                if (logoFile) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('branding')
                        .getPublicUrl(`system/${logoFile.name}`);
                    setLogo(publicUrl);
                }
            }

            // Fetch Footer Text
            const { data: footerData } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'footer_text')
                .single();

            if (footerData) setFooterText(footerData.value);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSaveFooter = async () => {
        setSavingFooter(true);
        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'footer_text',
                    value: footerText || '© 2025 Boost Homebroker. Todos os direitos reservados.'
                });

            if (error) throw error;
            alert('Texto do rodapé atualizado!');
        } catch (error) {
            console.error('Error saving footer:', error);
            alert('Erro ao salvar rodapé.');
        } finally {
            setSavingFooter(false);
        }
    };

    const handleDeleteUsers = async () => {
        if (!confirm('Tem certeza que deseja excluir os usuários selecionados?')) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .in('id', selectedUsers);

            if (error) throw error;

            setUsers(users.filter(user => !selectedUsers.includes(user.id)));
            setSelectedUsers([]);
        } catch (error) {
            console.error('Error deleting users:', error);
            alert('Erro ao excluir usuários. Verifique suas permissões.');
        }
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 100 * 1024) {
                alert('O arquivo deve ter no máximo 100KB.');
                return;
            }

            try {
                setUploadingLogo(true);
                const fileExt = file.name.split('.').pop();
                const fileName = `logo.${fileExt}`; // Overwrite 'logo' file
                const filePath = `system/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('branding')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('branding')
                    .getPublicUrl(filePath);

                setLogo(publicUrl);
                alert('Logo atualizada com sucesso!');
            } catch (error: any) {
                console.error('Error uploading logo:', error);
                alert('Erro ao atualizar logo: ' + error.message);
            } finally {
                setUploadingLogo(false);
            }
        }
    };

    return (
        <div>
            {/* Branding Section */}
            <section className="card mb-4">
                <h2 className="font-bold mb-4" style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Personalização</h2>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Logo Upload */}
                    <div className="flex flex-col gap-4">
                        <label className="text-sm font-bold">Logomarca do Sistema</label>
                        <div className="flex items-center gap-4">
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                border: '2px dashed var(--border)',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'var(--bg-secondary)',
                                overflow: 'hidden'
                            }}>
                                {logo ? (
                                    <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <span className="text-xs text-secondary">Logo</span>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className={`btn btn-primary text-sm cursor-pointer ${uploadingLogo ? 'opacity-50' : ''}`}>
                                    {uploadingLogo ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                    {uploadingLogo ? 'Enviando...' : 'Carregar Logo'}
                                    <input
                                        type="file"
                                        style={{ display: 'none' }}
                                        accept=".svg,.png,.jpg,.jpeg"
                                        onChange={handleLogoUpload}
                                        disabled={uploadingLogo}
                                    />
                                </label>
                                <span className="text-xs text-secondary">SVG, PNG ou JPG (Max. 100KB)</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <div className="flex flex-col gap-4">
                        <label className="text-sm font-bold">Texto do Rodapé</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={footerText}
                                onChange={(e) => setFooterText(e.target.value)}
                                placeholder="© 2025 Boost Homebroker. Todos os direitos reservados."
                            />
                            <button onClick={handleSaveFooter} className="btn btn-primary" disabled={savingFooter}>
                                {savingFooter ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            </button>
                        </div>
                        <span className="text-xs text-secondary">Deixe em branco para usar o padrão.</span>
                    </div>
                </div>
            </section>

            {/* Users Section */}
            {currentUserRole === 'admin' ? (
                <section className="card">
                    <div className="flex justify-between items-center mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        <h2 className="font-bold" style={{ fontSize: '1.125rem' }}>Usuários</h2>
                        <div className="flex gap-2">
                            {selectedUsers.length > 0 && (
                                <button onClick={handleDeleteUsers} className="btn btn-danger text-xs">
                                    <Trash2 size={14} /> Excluir ({selectedUsers.length})
                                </button>
                            )}
                            <button className="btn btn-primary text-xs"><Plus size={14} /> Novo Usuário</button>
                        </div>
                    </div>

                    {loadingUsers ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-secondary" />
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '2rem' }}>
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedUsers(users.map(u => u.id));
                                                    else setSelectedUsers([]);
                                                }}
                                                checked={selectedUsers.length === users.length && users.length > 0}
                                            />
                                        </th>
                                        <th>Nome</th>
                                        <th>Email</th>
                                        <th>Função</th>
                                        <th style={{ textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(user.id)}
                                                    onChange={() => toggleUserSelection(user.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div style={{
                                                        width: '2rem',
                                                        height: '2rem',
                                                        borderRadius: '50%',
                                                        backgroundColor: 'var(--accent)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#000',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.75rem',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            user.full_name ? user.full_name[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U')
                                                        )}
                                                    </div>
                                                    {user.full_name || 'Sem nome'}
                                                </div>
                                            </td>
                                            <td className="text-secondary">{user.email}</td>
                                            <td>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    backgroundColor: user.role === 'admin' ? 'rgba(188, 163, 111, 0.2)' : 'rgba(119, 141, 169, 0.2)',
                                                    color: user.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)'
                                                }}>
                                                    {user.role === 'admin' ? 'Administrador' : 'Assinante'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn-icon" style={{ padding: '0.5rem' }}>
                                                    <Edit size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ) : (
                <section className="card">
                    <p className="text-secondary text-center">Você não tem permissão para gerenciar usuários.</p>
                </section>
            )}
        </div>
    );
};
