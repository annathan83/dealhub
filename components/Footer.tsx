import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Wordmark */}
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Deal<span className="text-indigo-600">Hub</span>
        </Link>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <Link href="#features" className="hover:text-slate-900 transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-slate-900 transition-colors">
            Pricing
          </Link>
          <Link href="/signin" className="hover:text-slate-900 transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="hover:text-slate-900 transition-colors">
            Create Account
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
