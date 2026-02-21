import { Link } from "react-router-dom";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Full-screen WebGL background */}
      <WebGLShader />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <img
            src="/reforge-logo.png"
            alt="Reforge logo"
            className="h-8 w-8 object-contain"
          />
          <span className="text-white font-sans font-medium text-lg tracking-tight">
            Reforge
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button className="text-white/70 hover:text-white text-sm font-sans transition-colors">
            Log in
          </button>
          <Link to="/projects">
            <button className="bg-white text-black text-sm font-sans font-medium px-5 py-2 rounded-full hover:bg-white/90 transition-colors">
              Sign up
            </button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-28 pb-16">
        <h1
          className="text-white text-5xl sm:text-6xl lg:text-7xl font-normal leading-[1.12] max-w-4xl"
          style={{ fontFamily: "'Crimson Text', Georgia, serif" }}
        >
          Untangle Legacy Systems.{" "}
          Modernise with Confidence.
        </h1>

        <p className="mt-7 text-white/50 text-base sm:text-lg font-sans max-w-xl leading-relaxed">
          Reforge turns undocumented legacy complexity into structured system
          intelligence and intelligence into safe, staged modernisation.
        </p>

        <div className="mt-10">
          <Link to="/projects">
            <LiquidButton
              className="bg-white text-black border-0 rounded-full font-sans font-medium hover:bg-white/90"
              size="xl"
            >
              Get Started
            </LiquidButton>
          </Link>
        </div>
      </main>
    </div>
  );
}
