
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to dark, or check local storage
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    });

    const { user } = useAuth();

    // Apply theme to HTML element
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Tailwind 'dark' class support if needed (for libraries like flowbite? or just custom css variables)
        // Since we use CSS variables on [data-theme], we might not strictly need 'dark' class on HTML,
        // BUT if using tailwind `dark:` prefix, we need `class="dark"` on html when theme is dark.
        // Let's support both.
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Sync from profile on load
    useEffect(() => {
        if (!user) return;

        const fetchTheme = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('theme')
                    .eq('id', user.id)
                    .single();

                if (data?.theme && (data.theme === 'light' || data.theme === 'dark')) {
                    setTheme(data.theme);
                }
            } catch (err) {
                console.error("Error fetching theme preference:", err);
            }
        };

        fetchTheme();
    }, [user]);

    const toggleTheme = async () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);

        // Persist to DB if logged in
        if (user) {
            try {
                await supabase
                    .from('profiles')
                    .update({ theme: newTheme })
                    .eq('id', user.id);
            } catch (err) {
                console.error("Error saving theme preference:", err);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
