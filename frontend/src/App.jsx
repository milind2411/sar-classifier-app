import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChipProvider } from './context/ChipContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AnalysisPage from './pages/AnalysisPage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <ChipProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<AnalysisPage />} />
            <Route path="/map" element={<Navigate to="/app?tab=map" replace />} />
            <Route path="/analytics" element={<Navigate to="/app?tab=analytics" replace />} />
            <Route path="/compare" element={<Navigate to="/app?tab=compare" replace />} />
            <Route path="/angle" element={<Navigate to="/app?tab=sweep" replace />} />
            <Route path="/batch" element={<Navigate to="/app?tab=batch" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ChipProvider>
    </BrowserRouter>
  );
}
