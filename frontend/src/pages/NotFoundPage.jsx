import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found | SAR Classifier');

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="glass-panel p-8 max-w-md space-y-4">
        <span className="text-4xl font-mono font-bold text-accent">404</span>
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-muted text-xs">The requested path does not exist in the SAR-Vision workstation.</p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/app" className="btn-primary text-xs inline-flex items-center gap-2">
            Return to Analysis Workspace
          </Link>
          <Link to="/" className="btn-secondary text-xs inline-flex items-center gap-2">
            Landing Home
          </Link>
        </div>
      </div>
    </div>
  );
}

