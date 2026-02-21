import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Nav */}
      <header className="w-full px-8 py-6 flex items-center justify-between">
        <span className="font-serif text-xl tracking-tight font-semibold">
          CodeShift
        </span>
        <Link to="/projects">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10 font-serif"
          >
            Open App
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight">
            Untangle Legacy Systems.{" "}
            <span className="text-white/50">Transform with Confidence.</span>
          </h1>

          <p className="font-serif text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            CodeShift turns undocumented legacy complexity into structured system
            intelligence — and intelligence into safe, staged modernisation.
          </p>

          <div className="pt-4">
            <Link to="/projects">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-white/90 font-serif text-base px-8 py-6 rounded-full gap-3"
              >
                Analyse Your System
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Subtle footer line */}
      <footer className="px-8 py-6 text-center">
        <p className="text-white/20 text-sm font-serif">
          Legacy modernisation, reimagined.
        </p>
      </footer>
    </div>
  );
}
