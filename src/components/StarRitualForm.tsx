import { useState } from "react";
import { starSchema, type StarInput } from "@/lib/star-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onClose: () => void;
  onSubmit: (data: StarInput) => Promise<void>;
};

export function StarRitualForm({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!category) {
      setError("Please choose a category before sending your star.");
      return;
    }

    const parsed = starSchema.safeParse({ name, email, message, category });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your fields");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (err: any) {
      setError(err?.message ?? "Something interfered with the cosmos");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 md:px-6">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-[oklch(0.05_0.015_280/0.7)] backdrop-blur-md animate-slow-fade-in"
        onClick={onClose}
      />
      <form
        onSubmit={handle}
        className="relative w-full max-w-xl glass-panel px-6 py-10 md:px-10 md:py-14 animate-slow-fade-in max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        style={{ animationDuration: "1.2s" }}
      >
        <p className="text-meta text-muted-foreground mb-6 md:mb-8">The Ritual</p>
        <h2 className="font-display text-3xl md:text-5xl mb-2 leading-[1.05]">Place your star</h2>
        <p className="text-muted-foreground text-sm mb-8 md:mb-10 max-w-md font-light">
          Three small offerings. Your mark in this living sky.
        </p>

        <div className="space-y-6 md:space-y-7">
          <div>
            <label className="text-meta text-muted-foreground block mb-1">
              The name of your star
            </label>
            <input
              autoFocus
              className="ritual-input"
              placeholder="Vega"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className="text-meta text-muted-foreground block mb-1">
              Your email — kept private
            </label>
            <input
              type="email"
              className="ritual-input"
              placeholder="you@somewhere.earth"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <label className="text-meta text-muted-foreground block mb-1">
              Category — what brings you here
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="ritual-input border-0 border-b border-foreground/20 rounded-none px-0 h-auto py-2 focus:ring-0 focus:border-foreground/40">
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lokiai-waitlist">Join LokiAI Waitlist</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="reach-out">Reach Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-meta text-muted-foreground block mb-1">
              One sentence — your mark on the universe
            </label>
            <input
              className="ritual-input"
              placeholder="Build something that outlives you."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={180}
            />
            <p className="text-xs text-muted-foreground/60 mt-2 font-light">{message.length}/180</p>
          </div>
        </div>

        {error && <p className="mt-6 text-sm text-[oklch(0.7_0.18_25)] font-light">{error}</p>}

        <div className="mt-8 md:mt-10 flex flex-col-reverse md:flex-row md:items-center justify-between gap-4 md:gap-4">
          <button
            type="button"
            onClick={onClose}
            className="text-meta text-muted-foreground hover:text-foreground transition-colors py-2 md:py-0"
          >
            Not yet
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="quiet-button px-8 py-3 text-meta disabled:opacity-50 w-full md:w-auto text-center"
          >
            {submitting ? "Sending…" : "Send it into the cosmos"}
          </button>
        </div>
      </form>
    </div>
  );
}
