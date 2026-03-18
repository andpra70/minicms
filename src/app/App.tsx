import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AdminProvider } from '@/contexts/AdminContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PageLayout } from './components/PageLayout';
import { AdminPanel } from './components/AdminPanel';
import { getProjectNameFromUrl } from '@/app/lib/project-route';

export default function App() {
  const projectName = getProjectNameFromUrl();

  return (
    <ThemeProvider>
      <AdminProvider key={projectName || 'default-project'} projectName={projectName}>
        <HashRouter>
          <div 
            className="min-h-screen flex flex-col transition-colors duration-300"
            style={{ 
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)'
            }}
          >
            <Header />
            <Routes>
              <Route path="/" element={<PageLayout />} />
              <Route path="/:pageId" element={<PageLayout />} />
              <Route path="/:pageId/:subPageId" element={<PageLayout />} />
            </Routes>
            <Footer />
            <AdminPanel />
          </div>
        </HashRouter>
      </AdminProvider>
    </ThemeProvider>
  );
}
