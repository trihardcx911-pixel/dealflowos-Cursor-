import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackToDashboard() {
  return (
    <div className="mb-6">
      <Link 
        to="/dashboard"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-sm font-semibold tracking-wide text-white/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <ArrowLeft className="w-4 h-4" />
        Go back to Dashboard
      </Link>
    </div>
  );
}

