// Lite world map: equirectangular projection, plot bubbles by lat/lng on a styled SVG canvas.
// No topojson — uses a simple decorative background.

type City = {
  city_id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  active_users: number;
  members: number;
};

function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y };
}

export function WorldMap({ cities }: { cities: City[] }) {
  const w = 900;
  const h = 460;
  const max = Math.max(1, ...cities.map((c) => c.active_users));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        {/* Lat/long grid */}
        <rect x={0} y={0} width={w} height={h} fill="hsl(var(--muted))" />
        {[-60, -30, 0, 30, 60].map((lat) => {
          const { y } = project(lat, 0, w, h);
          return <line key={lat} x1={0} x2={w} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={0.5} />;
        })}
        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
          const { x } = project(0, lng, w, h);
          return <line key={lng} x1={x} x2={x} y1={0} y2={h} stroke="hsl(var(--border))" strokeWidth={0.5} />;
        })}
        {cities.map((c) => {
          const { x, y } = project(c.latitude, c.longitude, w, h);
          const r = 3 + (c.active_users / max) * 14;
          const alpha = 0.35 + (c.active_users / max) * 0.55;
          return (
            <g key={c.city_id}>
              <circle cx={x} cy={y} r={r} fill={`hsl(var(--primary) / ${alpha})`} stroke="hsl(var(--primary))" strokeWidth={0.6}>
                <title>{`${c.name}${c.country ? ", " + c.country : ""} — ${c.active_users} active / ${c.members} members`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
