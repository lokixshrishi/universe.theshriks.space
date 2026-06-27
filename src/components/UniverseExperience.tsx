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
  }, [introOpen]);

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
      />

      {formOpen && <StarRitualForm onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />}
    </main>
  );
}
