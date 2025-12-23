import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  TrendingUp,
  Settings,
  User,
  LogOut,
  Menu,
  List,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export const MainLayout: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [footerText, setFooterText] = useState(
    '© 2025 Boost Homebroker. Todos os direitos reservados.'
  );

  useEffect(() => {
    fetchSystemSettings();
    if (user) fetchUserProfile();
  }, [user]);

  const fetchSystemSettings = async () => {
    try {
      const { data: footerData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'footer_text')
        .single();
      if (footerData) setFooterText(footerData.value);

      const { data: files } = await supabase.storage.from('branding').list('system');
      if (files && files.length > 0) {
        const logoFile = files.find((f) => f.name.startsWith('logo.'));
        if (logoFile) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('branding').getPublicUrl(`system/${logoFile.name}`);
          setSystemLogo(publicUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user!.id)
        .single();
      if (data?.avatar_url) setUserAvatar(data.avatar_url);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/minha-lista', label: 'Minha Lista', icon: List },
    { path: '/lista-de-cartas', label: 'Lista de cartas', icon: Layers },
    { path: '/oportunidades', label: 'Oportunidades', icon: TrendingUp },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  const getPageTitle = () => {
    const item = navItems.find((i) => i.path === location.pathname);
    return item ? item.label : 'Boost Homebroker';
  };

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    signOut();
  };

  return (
    <div className="app-root min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* SIDEBAR VERTICAL (Desktop Only) */}
      <aside
        className={`sidebar hidden md:flex ${isSidebarCollapsed ? 'sidebar--collapsed' : 'sidebar--expanded'}`}
      >
        {/* Topo: botão hamburger */}
        <div className="sidebar__top">
          <button
            type="button"
            className="sidebar__hamburger"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          >
            <Menu size={30} color="#aab1bb" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar__nav-item ${isSidebarCollapsed ? 'sidebar__nav-item--collapsed' : 'sidebar__nav-item--expanded'
                  } ${isActive ? 'sidebar__nav-item--active' : ''}`}
                title={item.label}
              >
                <item.icon size={30} color="#aab1bb" />
                {!isSidebarCollapsed && <span className="sidebar__nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User avatar alinhado no bottom */}
        <div className="sidebar__user">
          <button
            type="button"
            className="sidebar__user-avatar-btn"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="User" className="sidebar__user-avatar-img" />
            ) : (
              <div className="sidebar__user-avatar-fallback">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
          </button>

          {/* Dropdown de usuário abrindo pra direita */}
          {isUserMenuOpen && (
            <div className="sidebar__user-menu">
              <div className="sidebar__user-menu-header">
                <p className="sidebar__user-email" title={user?.email ?? ''}>
                  {user?.email}
                </p>
                <p className="sidebar__user-role">{role}</p>
              </div>

              <div className="sidebar__user-menu-body">
                <Link
                  to="/perfil"
                  className="sidebar__user-menu-item"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <User size={18} color="#aab1bb" />
                  <span>Meu Perfil</span>
                </Link>
                <button
                  type="button"
                  className="sidebar__user-menu-item sidebar__user-menu-item--danger"
                  onClick={handleSignOut}
                >
                  <LogOut size={18} color="#fb7185" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION (Mobile Only) - Floating Island (Cool Slate/Purple) */}
      <nav className="fixed bottom-6 left-6 right-6 h-16 z-50 bg-[#09090b]/95 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl flex justify-around items-center md:hidden px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${isActive
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] transform -translate-y-1'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 active:scale-95'
                }`}
              title={item.label}
            >
              <item.icon size={24} className={isActive ? 'stroke-2' : 'stroke-[1.5]'} />
            </Link>
          );
        })}
      </nav>

      {/* ÁREA PRINCIPAL */}
      <main
        className={`layout-main transition-all duration-300 w-full ml-0 ${isSidebarCollapsed ? 'md:ml-[95px]' : 'md:ml-[256px]'}`}
      >
        {/* HEADER: Ultra compact mobile */}
        <header className="layout-header h-[50px] md:h-[75px] max-h-[50px] md:max-h-[75px] px-3 md:px-8">
          {systemLogo ? (
            <img src={systemLogo} alt="Logo" className="layout-header__logo h-6 md:h-10" />
          ) : (
            <div className="layout-header__logo-fallback">
              <div className="layout-header__logo-icon w-7 h-7 md:w-8 md:h-8">
                <LayoutDashboard size={14} />
              </div>
              <span className="layout-header__logo-text text-sm md:text-lg">Boost</span>
            </div>
          )}

          <div className="layout-header__divider hidden md:block" />

          <h1 className="layout-header__title text-sm md:text-2xl">{getPageTitle()}</h1>
        </header>

        {/* CONTEÚDO DA PÁGINA - Margens Condicionais */}
        <div className={`layout-content ${location.pathname === '/' ? 'p-0' : 'p-[10px]'} pb-20 md:p-8 md:pb-8`}>
          <Outlet />
        </div>

        {/* RODAPÉ */}
        <footer className="layout-footer hidden md:block px-8 py-4 text-center text-sm text-gray-400">
          <p>{footerText}</p>
        </footer>
      </main>
    </div>
  );
};