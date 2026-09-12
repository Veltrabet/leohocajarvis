import { motion } from "motion/react";

export type OrbState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

const SPEC: Record<OrbState, { core: string; glow: string; label: string; ring: string }> = {
  IDLE: { core: "#00F0FF", glow: "rgba(0,240,255,0.40)", label: "SİSTEM HAZIR", ring: "6s" },
  LISTENING: { core: "#00FFA3", glow: "rgba(0,255,163,0.60)", label: "SESLİ DİNLENİYOR", ring: "2.5s" },
  THINKING: { core: "#BD00FF", glow: "rgba(189,0,255,0.55)", label: "ANALİZ EDİLİYOR", ring: "1.5s" },
  SPEAKING: { core: "#38BDF8", glow: "rgba(56,189,248,0.70)", label: "JARVIS KONUŞUYOR", ring: "1.8s" },
};

interface Props {
  state: OrbState;
  size?: number;
  onClick?: () => void;
}

export default function JarvisOrb({ state, size = 280, onClick }: Props) {
  const s = SPEC[state];
  const active = state !== "IDLE";
  const bars = Array.from({ length: 24 });

  return (
    <div
      className="relative flex select-none items-center justify-center"
      style={{ width: size, height: size }}
      data-testid="jarvis-orb"
      data-orb-state={state}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`LEO durumu: ${s.label}`}
    >
      {/* reticle */}
      <svg className="absolute inset-0 opacity-40" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="96" fill="none" stroke={s.core} strokeOpacity="0.18" strokeWidth="0.6" />
        {Array.from({ length: 60 }).map((_, i) => (
          <line
            key={i}
            x1="100"
            y1="4"
            x2="100"
            y2={i % 5 === 0 ? 12 : 8}
            stroke={s.core}
            strokeOpacity={i % 5 === 0 ? 0.55 : 0.22}
            strokeWidth="0.8"
            transform={`rotate(${i * 6} 100 100)`}
          />
        ))}
      </svg>

      {/* orbital rings */}
      <motion.div
        className="absolute rounded-full border border-dashed"
        style={{ inset: "8%", borderColor: s.core, opacity: 0.45 }}
        animate={{ rotate: 360 }}
        transition={{ duration: active ? 4 : 14, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          inset: "18%",
          borderColor: "transparent",
          borderTopColor: s.core,
          borderRightColor: s.core,
          opacity: 0.7,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: active ? 2.4 : 9, repeat: Infinity, ease: "linear" }}
      />

      {/* spectrum bars */}
      <div className="absolute inset-0" aria-hidden="true">
        {bars.map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 origin-bottom"
            style={{ transform: `rotate(${i * 15}deg) translateY(-${size * 0.42}px)` }}
          >
            <div
              style={{
                width: 2,
                height: active ? 14 : 7,
                background: s.core,
                opacity: active ? 0.9 : 0.35,
                borderRadius: 2,
                animation: active ? `q8-bar ${0.5 + (i % 6) * 0.12}s ease-in-out infinite` : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* core */}
      <motion.div
        className="relative flex h-[46%] w-[46%] items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${s.core} 38%, #041427 100%)`,
          boxShadow: `0 0 70px 18px ${s.glow}, inset 0 0 40px rgba(255,255,255,0.28)`,
        }}
        animate={{ scale: active ? [1, 1.09, 1] : [1, 1.045, 1] }}
        transition={{ duration: active ? 0.9 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="pointer-events-none absolute bottom-[-6px] left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="q8-overline" style={{ color: s.core }} data-testid="orb-state-label">
          {s.label}
        </span>
      </div>
    </div>
  );
}
