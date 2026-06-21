import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Share2, Copy, Image as ImageIcon, Type, Check, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StoryCard } from "./story-card";
import { logShareEvent } from "@/lib/collab.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  postId: string;
  slug: string;
  title: string;
  hostName: string;
  hostAvatarUrl?: string | null;
  roles: string[];
  category: string;
  location: string;
  compensation: string;
};

export function ShareCollabSheet(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "caption" | null>(null);
  const [generating, setGenerating] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const logShare = useServerFn(logShareEvent);
  const { user } = useAuth();
  const [refUsername, setRefUsername] = useState<string | null>(null);

  // Lazy-fetch viewer username so outbound shares carry inviter attribution.
  useEffect(() => {
    if (!open || !user || refUsername !== null) return;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setRefUsername(data?.username ?? ""));
  }, [open, user, refUsername]);

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/collab/${props.slug}`
    : `https://workshopindie.com/collab/${props.slug}`;
  const url = refUsername ? `${baseUrl}?ref=${refUsername}` : baseUrl;

  const caption =
    `${pickEmoji(props.category)} Open call: ${props.title}\n` +
    `${props.roles.length ? `Looking for: ${props.roles.slice(0, 3).join(", ")}\n` : ""}` +
    `Apply ↓\n${url}`;


  async function copy(text: string, what: "link" | "caption", channel: "copy" | "caption") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
      logShare({ data: { collabPostId: props.postId, channel } });
    } catch {
      toast.error("Couldn't copy — try again");
    }
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      copy(url, "link", "copy");
      return;
    }
    try {
      await navigator.share({ title: props.title, text: caption, url });
      logShare({ data: { collabPostId: props.postId, channel: "native" } });
      setOpen(false);
    } catch {
      // user cancelled — silent
    }
  }

  async function downloadStory() {
    if (!storyRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(storyRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1920,
      });
      const link = document.createElement("a");
      link.download = `${props.slug}-workshop-story.png`;
      link.href = dataUrl;
      link.click();
      logShare({ data: { collabPostId: props.postId, channel: "story_image" } });
      toast.success("Story image saved — open Instagram and add it as a story.");
    } catch {
      toast.error("Couldn't generate the image. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="rounded-full gap-2">
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share this call</DialogTitle>
            <DialogDescription>
              Drop the link in your Instagram story, group chat, or DMs — applicants don't need a Workshop account to reply.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button className="w-full justify-start gap-3 rounded-2xl" onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> Share via…
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 rounded-2xl"
              onClick={() => copy(url, "link", "copy")}
            >
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "link" ? "Link copied" : "Copy link"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 rounded-2xl"
              onClick={() => copy(caption, "caption", "caption")}
            >
              {copied === "caption" ? <Check className="h-4 w-4" /> : <Type className="h-4 w-4" />}
              {copied === "caption" ? "Caption copied" : "Copy caption"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 rounded-2xl"
              onClick={downloadStory}
              disabled={generating}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {generating ? "Generating…" : "Download story image (1080×1920)"}
            </Button>
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            Tip: download the story image, open Instagram → New story → pick it from your camera roll → add the link sticker pointing to your call.
          </p>
        </DialogContent>
      </Dialog>

      {/* Off-screen story card for html-to-image. Kept in DOM but visually hidden. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          opacity: 0,
          zIndex: -1,
          transform: "translate(-200vw, 0)",
        }}
      >
        <StoryCard
          ref={storyRef}
          title={props.title}
          hostName={props.hostName}
          hostAvatarUrl={props.hostAvatarUrl}
          roles={props.roles}
          category={props.category}
          location={props.location}
          compensation={props.compensation}
          url={url}
        />
      </div>
    </>
  );
}

function pickEmoji(category: string) {
  const map: Record<string, string> = {
    film: "🎬", music: "🎵", writing: "✍️", build: "🛠", visual: "🎨",
  };
  return map[category.toLowerCase()] ?? "✨";
}
