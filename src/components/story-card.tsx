import { forwardRef } from "react";

export type StoryCardProps = {
  title: string;
  hostName: string;
  hostAvatarUrl?: string | null;
  roles: string[];
  category: string;
  location: string;
  compensation: string;
  url: string;
};

/**
 * 1080×1920 IG-story card, rendered offscreen and exported to PNG via html-to-image.
 * Keep all styling inline so the rasterizer doesn't need to walk our token system.
 */
export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(function StoryCard(
  { title, hostName, hostAvatarUrl, roles, category, location, compensation, url },
  ref,
) {
  const visibleRoles = roles.slice(0, 4);
  const overflow = roles.length - visibleRoles.length;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        background: "linear-gradient(155deg, #0f0f12 0%, #1a1820 55%, #2a1f33 100%)",
        color: "#ffffff",
        padding: "120px 90px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* soft glow accent */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,120,180,0.35) 0%, rgba(255,120,180,0) 70%)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 18, zIndex: 1 }}>
        <span
          style={{
            padding: "10px 22px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Open call · {category}
        </span>
      </div>

      <div style={{ zIndex: 1 }}>
        <h1
          style={{
            fontSize: 110,
            lineHeight: 1.02,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            fontFamily: "'Instrument Serif', 'Cormorant Garamond', Georgia, serif",
          }}
        >
          {truncate(title, 90)}
        </h1>

        <div style={{ marginTop: 60, display: "flex", flexWrap: "wrap", gap: 16 }}>
          {visibleRoles.map((r) => (
            <span
              key={r}
              style={{
                padding: "18px 32px",
                borderRadius: 999,
                background: "#ffffff",
                color: "#0f0f12",
                fontSize: 32,
                fontWeight: 600,
              }}
            >
              {r}
            </span>
          ))}
          {overflow > 0 && (
            <span
              style={{
                padding: "18px 32px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                fontSize: 32,
                fontWeight: 600,
              }}
            >
              +{overflow} more
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 36,
            fontSize: 30,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          <span>📍 {location}</span>
          <span>💰 {compensation}</span>
        </div>
      </div>

      <div style={{ zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 56 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            {hostAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hostAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              hostName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontSize: 28, opacity: 0.7 }}>Posted by</div>
            <div style={{ fontSize: 40, fontWeight: 600 }}>{hostName}</div>
          </div>
        </div>

        <div
          style={{
            padding: "32px 44px",
            borderRadius: 36,
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 26, opacity: 0.7 }}>Apply at</div>
            <div style={{ fontSize: 36, fontWeight: 600 }}>{prettyUrl(url)}</div>
          </div>
          <div style={{ fontSize: 56 }}>→</div>
        </div>

        <div style={{ marginTop: 44, textAlign: "center", fontSize: 28, opacity: 0.55, letterSpacing: "0.18em" }}>
          WORKSHOP
        </div>
      </div>
    </div>
  );
});

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function prettyUrl(u: string) {
  return u.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
