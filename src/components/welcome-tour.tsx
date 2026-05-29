import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Users, Sparkles, ArrowRight, X } from "lucide-react";

type Choice = {
  id: "publish" | "collab" | "instant";
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  accent: string;
};

const CHOICES: Choice[] = [
  {
    id: "publish",
    icon: <Upload className="h-5 w-5" />,
    title: "Publish your first work",
    body: "Drop a track, a clip, a photo set. It lives on your profile forever.",
    to: "/works/new",
    accent: "from-pink-500/15 to-orange-400/10",
  },
  {
    id: "collab",
    icon: <Users className="h-5 w-5" />,
    title: "Post a Collab",
    body: "Need a vocalist, a DP, a dancer? Put the call out and see who shows up.",
    to: "/collab/new",
    accent: "from-violet-500/15 to-sky-400/10",
  },
  {
    id: "instant",
    icon: <Sparkles className="h-5 w-5" />,
    title: "Drop into a live Workshop",
    body: "Walk into a room of up to 5 and just start making something, right now.",
    to: "/instant",
    accent: "from-emerald-500/15 to-teal-400/10",
  },
];

export function WelcomeTour() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    // Open immediately if we just came from onboarding
    let forcedOpen = false;
    try {
      if (sessionStorage.getItem("ws.welcome_open") === "1") {
        sessionStorage.removeItem("ws.welcome_open");
        forcedOpen = true;
      }
    } catch { /* ignore */ }

    supabase
      .from("profiles")
      .select("tour_completed_at,onboarded")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (forcedOpen && data?.onboarded) { setOpen(true); return; }
        if (data?.onboarded && !data?.tour_completed_at) setOpen(true);
      });
    return () => { cancelled = true; };
  }, [user, loading]);

  const markFinished = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ tour_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  };

  const pick = async (c: Choice) => {
    setOpen(false);
    try { sessionStorage.setItem("ws.first_run_hint", c.id); } catch { /* ignore */ }
    await markFinished();
    navigate({ to: c.to });
  };

  const skip = async () => {
    setOpen(false);
    await markFinished();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={skip}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="relative w-full max-w-lg rounded-t-3xl border border-border bg-surface p-6 shadow-soft sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={skip}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-muted hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Step 2 of 2 — Pick your first move</p>
            <h2 className="mt-1 font-display text-2xl text-ink">You're in. What do you want to do first?</h2>
            <p className="mt-1 text-sm text-ink-muted">Pick one — we'll point you there. You can do the others anytime.</p>

            <div className="mt-5 space-y-2.5">
              {CHOICES.map((c, i) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.07, type: "spring", stiffness: 240, damping: 22 }}
                  whileHover={{ y: -2 }}
                  onClick={() => pick(c)}
                  className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.accent} p-4 text-left transition hover:border-ink/20 hover:shadow-soft`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-ink ring-1 ring-border">
                    {c.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{c.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{c.body}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
                </motion.button>
              ))}
            </div>

            <div className="mt-5 flex justify-center">
              <button
                onClick={skip}
                className="text-xs text-ink-muted hover:text-ink"
              >
                I'll explore on my own
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
