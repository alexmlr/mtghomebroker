import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { MyList } from './pages/MyList';
import { Collections } from './pages/Collections';
import { Opportunities } from './pages/Opportunities';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { CardDetails } from './pages/CardDetails';
import { ProtectedRoute } from './components/ProtectedRoute';

import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="minha-lista" element={<MyList />} />
              <Route path="lista-de-cartas" element={<Collections />} />
              <Route path="oportunidades" element={<Opportunities />} />
              <Route path="configuracoes" element={<Settings />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="carta/:id" element={<CardDetails />} />
            </Route>
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
