import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import OwnAiSection from "@/components/OwnAiSection";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import AuthEntrySection from "@/components/AuthEntrySection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />
      <main>
        {/* 1. Hero — headline, subheadline, product mockup */}
        <Hero />
        {/* 2. Problem — deal fragmentation */}
        <ProblemSection />
        {/* 3. Solution — 3-pillar: Workspace / Facts / Analysis */}
        <SolutionSection />
        {/* 4. Use your own AI */}
        <OwnAiSection />
        {/* 5. How it works — 3 steps */}
        <HowItWorks />
        {/* 6. Trust / philosophy */}
        <TrustSection />
        {/* 7. Final CTA */}
        <AuthEntrySection />
      </main>
      <Footer />
    </div>
  );
}
