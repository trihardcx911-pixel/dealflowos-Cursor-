import { Link } from "react-router-dom";

export default function BackToDashboard() {
  return (
    <div className="mb-6">
      <Link 
        to="/"
        className="text-white/80 hover:text-white transition font-semibold underline"
      >
        ← Go back to Dashboard
      </Link>
    </div>
  );
}

