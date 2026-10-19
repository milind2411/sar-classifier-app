import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChipProvider } from './context/ChipContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AnalysisPage from './pages/AnalysisPage';
import AboutPage from './pages/AboutPage';
import BatchPage from './pages/BatchPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PrivacyPage from './pages/PrivacyPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ChipProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<AnalysisPage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/compare" element={<Navigate to="/app" replace />} />
            <Route path="/angle" element={<Navigate to="/app" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ChipProvider>
    </BrowserRouter>
  );
}
