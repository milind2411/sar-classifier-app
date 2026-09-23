import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="glass-panel p-8 max-w-md space-y-4">
        <span className="text-4xl font-mono font-bold text-accent">404</span>
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-muted text-xs">The requested path does not exist in the SAR-Vision workstation.</p>
        <div className="pt-2">
          <Link to="/app" className="btn-primary text-xs inline-flex items-center gap-2">
            Return to Analysis Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
