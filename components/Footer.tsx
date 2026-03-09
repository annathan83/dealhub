import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

        {/* Wordmark */}
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Deal<span className="text-indigo-600">Hub</span>
        </Link>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
            How it works
          </a>
          <a href="#pillars" className="hover:text-slate-900 transition-colors">
            Features
          </a>
          <Link href="/signin" className="hover:text-slate-900 transition-colors">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-slate-900 transition-colors">
            Start a deal
          </Link>
        </nav>

        {/* Legal */}
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} DealHub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
