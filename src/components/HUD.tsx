import { useEffect, useRef, useState } from "react";

type Props = {
  starCount: number;
  nebulaCount: number;
  galaxyCount: number;
  onAddStar: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onSearch: (q: string) => boolean;
  onOpenInfo: () => void;
};

export function HUD({
  starCount,
  nebulaCount,
  galaxyCount,
  onAddStar,
  muted,
  onToggleMute,
  onSearch,
  onOpenInfo,
}: Props) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    const found = onSearch(search.trim());
    if (!found) {
      setSearchError(true);
      setTimeout(() => setSearchError(false), 1800);
    } else {
      setSearch("");
      setSearchOpen(false);
    }
  };

  return (
    <>
      {/* Top left — logo */}
      <div className="fixed top-4 left-4 md:top-6 md:left-8 z-40 animate-slow-fade-in pointer-events-none">
        <p className="text-meta text-muted-foreground/70 mb-1">The</p>
        <h1 className="font-display text-xl md:text-2xl tracking-tight leading-none">Shriks Universe</h1>
      </div>

      {/* Top right — sound toggle + search + user menu */}
      <div className="fixed top-4 right-4 md:top-6 md:right-8 z-40 flex items-center gap-2 md:gap-3 animate-slow-fade-in">
        <form
          onSubmit={submitSearch}
          className={`flex items-center transition-all duration-700 ${
            searchOpen ? "w-40 md:w-64" : "w-24 md:w-32"
          }`}
        >
          {searchOpen ? (
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => !search && setSearchOpen(false)}
              placeholder={searchError ? "no star by that name" : "name of a star…"}
              className={`bg-transparent border-b text-sm font-light py-1.5 w-full text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                searchError
                  ? "border-[oklch(0.7_0.18_25)] placeholder:text-[oklch(0.7_0.18_25)]"
                  : "border-foreground/30 focus:border-foreground/70"
              }`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-meta text-muted-foreground hover:text-foreground transition-colors"
            >
              Find a star
            </button>
          )}
        </form>
        <span className="h-4 w-px bg-foreground/20" />
        <button
          onClick={onOpenInfo}
          className="text-muted-foreground hover:text-foreground transition-colors border border-foreground/20 rounded-full w-5 h-5 flex items-center justify-center text-xs font-serif italic bg-foreground/5 hover:bg-foreground/10"
          aria-label="View Project Info"
        >
          i
        </button>
        <span className="h-4 w-px bg-foreground/20" />
        <button
          onClick={onToggleMute}
          className="text-meta text-muted-foreground hover:text-foreground transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      {/* Bottom left — counter */}
      <div className="fixed bottom-20 left-4 md:bottom-7 md:left-8 z-40 animate-slow-fade-in-delayed pointer-events-none">
        <p className="text-meta text-muted-foreground mb-1.5">A living census</p>
        <p className="font-display text-base md:text-lg leading-none">
          <span>{starCount.toLocaleString()}</span>
          <span className="text-muted-foreground"> stars · </span>
          <span>{nebulaCount}</span>
          <span className="text-muted-foreground hidden sm:inline"> nebulae · </span>
          <span className="text-muted-foreground sm:hidden"> nebulae </span>
          <span className="hidden sm:inline">{galaxyCount}</span>
          <span className="text-muted-foreground hidden sm:inline"> galaxies</span>
        </p>
      </div>

      {/* Bottom right — add star */}
      <div className="fixed bottom-6 left-4 right-4 md:left-auto md:bottom-7 md:right-8 z-40 animate-slow-fade-in-delayed flex justify-center">
        <button onClick={onAddStar} className="quiet-button px-6 py-2.5 text-meta w-full md:w-auto text-center">
          Add your star
        </button>
      </div>
    </>
  );
}
