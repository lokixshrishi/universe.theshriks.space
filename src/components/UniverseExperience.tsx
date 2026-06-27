import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Universe, type StarRecord, type UniverseHandle } from "@/components/Universe";
import { HUD } from "@/components/HUD";
import { StarRitualForm } from "@/components/StarRitualForm";
import { supabase } from "@/integrations/supabase/client";
import { createStar } from "@/lib/stars.functions";
import { colorForName, sizeForName, positionForName, type StarInput } from "@/lib/star-utils";
import { startDrone, chime, setMuted as setAudioMuted, isMuted } from "@/lib/audio";

let globalHasSeenIntro = false;

const getInitialIntroState = (initialFocusId: string | null) => {
  if (initialFocusId) {
    globalHasSeenIntro = true;
    return false;
  }
  if (globalHasSeenIntro) {
    return false;
  }
  return true;
};
export function UniverseExperience({ initialFocusId }: { initialFocusId: string | null }) {
  const [stars, setStars] = useState<StarRecord[]>([]);
  const [hover, setHover] = useState<{ s: StarRecord; x: number; y: number } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [letterOpen, setLetterOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("shriks_universe_letter_seen");
    }
    return true;
  });
  const [introOpen, setIntroOpen] = useState(() => getInitialIntroState(initialFocusId));
  const universeRef = useRef<UniverseHandle>(null);
  const createStarFn = useServerFn(createStar);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("stars")
        .select("id, name, message, category, x, y, z, color, size, created_at")
        .order("created_at", { ascending: true })
        .limit(10000);
      if (!cancelled && data) setStars(data as StarRecord[]);
    })();

    const channel = supabase
      .channel("stars-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stars" }, (payload) => {
        const s = payload.new as StarRecord;
        setStars((prev) => (prev.find((p) => p.id === s.id) ? prev : [...prev, s]));
        if (!isMuted()) chime();
        setTimeout(() => universeRef.current?.flyToStar(s.id, { close: true }), 250);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (letterOpen) return; // Pause intro until the welcome letter is closed
    if (!introOpen) {
      globalHasSeenIntro = true;
      return;
    }
    const t = setTimeout(() => {
      setIntroOpen(false);
      globalHasSeenIntro = true;
    }, 7000);
    return () => {
      clearTimeout(t);
      globalHasSeenIntro = true;
    };
  }, [introOpen, letterOpen]);

  const handleSubmit = useCallback(
    async (input: StarInput) => {
      const [x, y, z] = positionForName(input.name + Date.now());
      const color = colorForName(input.name);
      const size = sizeForName(input.name);
      
      const created = await createStarFn({
        data: { ...input, x, y, z, color, size },
      });
      
      setStars((prev) =>
        prev.find((p) => p.id === (created as any).id) ? prev : [...prev, created as StarRecord],
      );
      
      setFormOpen(false);
      if (!isMuted()) chime();
      setTimeout(() => universeRef.current?.flyToStar((created as any).id, { close: true }), 350);
    },
    [createStarFn],
  );

  const toggleMute = useCallback(() => {
    if (muted) startDrone();
    setAudioMuted(!muted);
    setMuted(!muted);
  }, [muted]);

  const search = useCallback((q: string) => {
    const found = universeRef.current?.findByName(q);
    if (!found) return false;
    universeRef.current?.flyToStar(found.id, { close: true });
    return true;
  }, []);

  const handleClickStar = useCallback(
    (s: StarRecord) => {
      universeRef.current?.flyToStar(s.id, { close: true });
      navigate({ to: "/star/$id", params: { id: s.id } });
    },
    [navigate],
  );

  const nebulaCount = Math.floor(stars.length / 100);
  const galaxyCount = Math.floor(nebulaCount / 100);

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <Universe
        ref={universeRef}
        stars={stars}
        onHover={(s, p) => (s && p ? setHover({ s, x: p.x, y: p.y }) : setHover(null))}
        onClick={handleClickStar}
        initialFocusId={initialFocusId}
      />

      {hover && (
        <div
          className="fixed z-30 pointer-events-none star-tooltip rounded-full px-3 py-1.5 max-w-xs glass-panel animate-fade-in flex items-center gap-2"
          style={{ left: hover.x + 18, top: hover.y - 8 }}
        >
          <span className="text-meta text-muted-foreground/90 font-medium">{hover.s.name}</span>
          <span className="text-[0.65rem] truncate max-w-[120px] text-muted-foreground/60">
            {hover.s.message}
          </span>
        </div>
      )}

      {/* Click Detailed View */}
      {initialFocusId && stars.find((s) => s.id === initialFocusId) && (
        <div className="fixed top-24 left-4 right-4 md:left-auto md:right-8 z-40 w-auto md:w-80 glass-panel p-6 animate-slide-up">
          <button
            onClick={() => navigate({ to: "/" })}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>

          <div className="mb-4">
            <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-sm bg-foreground/10 text-foreground/70 inline-block mb-3">
              {stars.find((s) => s.id === initialFocusId)?.category?.replace("-", " ") || "Star"}
            </span>
            <h2 className="font-display text-2xl leading-tight">
              {stars.find((s) => s.id === initialFocusId)?.name}
            </h2>
            <p className="text-[0.7rem] text-muted-foreground/50 tracking-wide uppercase mt-1">
              {new Date(
                stars.find((s) => s.id === initialFocusId)?.created_at || Date.now(),
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="h-px w-full bg-foreground/10 my-4" />

          <p className="font-display text-lg leading-snug text-foreground/90 italic">
            "{stars.find((s) => s.id === initialFocusId)?.message}"
          </p>
        </div>
      )}

      {introOpen && (
        <div className="fixed inset-x-0 bottom-1/3 z-30 pointer-events-none flex flex-col items-center text-center px-6">
          <p className="font-display text-2xl md:text-3xl italic leading-snug max-w-xl text-foreground/85 animate-slow-fade-in">
            This universe is built by the people who find it.
          </p>
          <p className="text-meta text-muted-foreground mt-6 animate-slow-fade-in-delayed">
            Drag · scroll · or place your own star
          </p>
        </div>
      )}

      <HUD
        starCount={stars.length}
        nebulaCount={nebulaCount}
        galaxyCount={galaxyCount}
        onAddStar={() => setFormOpen(true)}
        muted={muted}
        onToggleMute={toggleMute}
        onSearch={search}
        onOpenInfo={() => setLetterOpen(true)}
      />

      {formOpen && <StarRitualForm onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />}

      {letterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07070a]/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-2xl w-full glass-panel p-8 md:p-12 relative animate-scale-in border border-foreground/10 shadow-2xl flex flex-col items-center">
            {/* Elegant Close Button */}
            <button
              onClick={() => {
                setLetterOpen(false);
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("shriks_universe_letter_seen", "true");
                }
              }}
              className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground transition-colors text-sm font-light tracking-widest uppercase"
              aria-label="Close Info"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/50 block mb-2 font-medium">
                A Living Cosmology
              </span>
              <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground/90 font-light">
                Why this platform exists
              </h2>
              <div className="h-[1px] w-12 bg-foreground/10 mx-auto mt-4" />
            </div>

            {/* Letter Body */}
            <div className="space-y-6 text-foreground/80 leading-relaxed font-light text-sm md:text-base font-sans tracking-wide">
              <p>
                The website is built around the idea that every visitor becomes a part of a shared universe. 
                Each star represents a real person who has interacted with us—whether by joining the waitlist 
                for our first product, sharing feedback, suggesting new ideas, or simply reaching out. 
                As more people connect with us, the universe continues to grow, with every new interaction 
                creating another star.
              </p>
              <p>
                Rather than being a traditional landing page, the website serves as a living visualization 
                of our community. It allows us to understand what people think, collect their opinions and 
                suggestions, and build a closer relationship with everyone who joins us. Every star is a 
                reminder that behind every interaction is a real person contributing to the journey and 
                helping shape what we build next.
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                setLetterOpen(false);
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("shriks_universe_letter_seen", "true");
                }
              }}
              className="mt-10 quiet-button px-8 py-3 text-meta text-center tracking-[0.15em] uppercase hover:bg-foreground/5 transition-all duration-300"
            >
              Enter the Universe
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
