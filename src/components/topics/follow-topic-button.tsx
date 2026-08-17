import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SignupGateModal } from "@/components/signup-gate-modal";
import { myTopicFollows, toggleMediumFollow, toggleTopicFollow } from "@/lib/topics.functions";

type Props =
  | { kind: "topic"; topicId: string; label: string }
  | { kind: "medium"; fieldId: string; label: string };

/**
 * Follow a Topic or a Medium. Following feeds the "For You" and "Following"
 * tabs on the Blog; logged-out readers get the signup gate instead.
 */
export function FollowTopicButton(props: Props) {
  const { user } = useAuth();
  const loadFollows = useServerFn(myTopicFollows);
  const toggleTopic = useServerFn(toggleTopicFollow);
  const toggleMedium = useServerFn(toggleMediumFollow);

  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setFollowing(false);
      return;
    }
    void loadFollows({ data: undefined })
      .then((res) => {
        if (cancelled || !res) return;
        setFollowing(
          props.kind === "topic"
            ? res.topicIds.includes(props.topicId)
            : res.fieldIds.includes(props.fieldId),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, props.kind, props.kind === "topic" ? props.topicId : props.fieldId]);

  async function onClick() {
    if (!user) {
      setGateOpen(true);
      return;
    }
    const next = !following;
    setBusy(true);
    setFollowing(next);
    try {
      if (props.kind === "topic") {
        await toggleTopic({ data: { topicId: props.topicId, follow: next } });
      } else {
        await toggleMedium({ data: { fieldId: props.fieldId, follow: next } });
      }
    } catch {
      setFollowing(!next);
      toast.error("Couldn't update that follow. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={following ? "outline" : "default"}
        disabled={busy}
        onClick={onClick}
        className="rounded-full"
      >
        {following ? (
          <>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Following
          </>
        ) : (
          <>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Follow
          </>
        )}
      </Button>
      <SignupGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={`Follow ${props.label}`}
        subtitle="Join Workshop to follow topics and build a feed that matches what you make."
      />
    </>
  );
}
