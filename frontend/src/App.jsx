import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChipProvider } from './context/ChipContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AnalysisPage from './pages/AnalysisPage';
import ComparePage from './pages/ComparePage';
import AnglePage from './pages/AnglePage';
import BatchPage from './pages/BatchPage';
import MapPage from './pages/MapPage';
import AnalyticsPage from './pages/AnalyticsPage';
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
            <Route path="/map" element={<MapPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/angle" element={<AnglePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ChipProvider>
    </BrowserRouter>
  );
}
