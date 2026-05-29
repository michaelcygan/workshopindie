import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Image as ImageIcon, MessageSquare, X } from "lucide-react";

type Step = {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Welcome to Workshop",
    body: "Find people. Make things. Build a portfolio that gets you hired.",
    cta: { label: "See the gallery", to: "/" },
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Drop into a live room",
    body: "A live room of up to 5. Walk in, meet whoever's around, get to work.",
    cta: { label: "Drop in", to: "/instant" },
  },
  {
    icon: <ImageIcon className="h-5 w-5" />,
    title: "Post a Collab",
    body: "Need a vocalist, a dancer, a DP? Post it. Open a room on it whenever you're ready.",
    cta: { label: "Browse Collabs", to: "/collab" },
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Build your circle",
    body: "Follow artists. Once you follow each other, you can DM and credit each other on works.",
    cta: { label: "Finish tour", to: "/" },
  },
];

export function WelcomeTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("tour_completed_at,onboarded")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.onboarded && !data?.tour_completed_at) setOpen(true);
      });
    return () => { cancelled = true; };
  }, [user, loading]);

  const finish = async () => {
    setOpen(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ tour_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  };

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
        onClick={finish}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 shadow-soft sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={finish}
            className="absolute right-4 top-4 rounded-full p-1.5 text-ink-muted hover:bg-muted"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">{s.icon}</div>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition ${i === step ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>

          <h2 className="mt-4 font-display text-2xl text-ink">{s.title}</h2>
          <p className="mt-2 text-sm text-ink-muted">{s.body}</p>

          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              onClick={finish}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Skip
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" className="rounded-full" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {isLast ? (
                <Button asChild className="rounded-full" onClick={finish}>
                  <Link to={s.cta.to}>{s.cta.label}</Link>
                </Button>
              ) : (
                <Button className="rounded-full" onClick={() => setStep((s) => s + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
