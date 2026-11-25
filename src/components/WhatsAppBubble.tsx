import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/firebase";

interface WhatsAppConfig {
  enabled: boolean;
  groupLink: string;
  label: string;
}

interface BubblePos {
  x: number;
  y: number;
}

const BUBBLE_SIZE = 58;
const EDGE_MARGIN = 14;
const STORAGE_KEY = "autex_wa_bubble_pos_v1";

function clampPos(x: number, y: number): BubblePos {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
  };
}

function getDefaultPos(): BubblePos {
  if (typeof window === "undefined") return { x: 20, y: 400 };
  return clampPos(window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN, window.innerHeight - BUBBLE_SIZE - 94);
}

function loadSavedPos(): BubblePos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        return clampPos(parsed.x, parsed.y);
      }
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultPos();
}

export function WhatsAppBubble() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [pos, setPos] = useState<BubblePos>(loadSavedPos);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const r = ref(db, "settings/whatsapp");
    return onValue(
      r,
      (snap) => {
        const val = snap.val();
        if (val && typeof val === "object" && val.enabled && val.groupLink) {
          setConfig({
            enabled: true,
            groupLink: String(val.groupLink).trim(),
            label: String(val.label || "Join WhatsApp Group").trim(),
          });
        } else {
          setConfig(null);
        }
      },
      () => setConfig(null)
    );
  }, []);

  // Keep bubble inside viewport on window resize
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        const next = clampPos(prev.x, prev.y);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Auto-collapse initial tooltip after 6s so it stays unobtrusive
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!config || !config.enabled || !config.groupLink) {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) >= 6) {
      d.moved = true;
    }
    if (d.moved) {
      setPos(clampPos(d.originX + dx, d.originY + dy));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = null;
    setDragging(false);

    if (!d.moved) {
      window.open(config.groupLink, "_blank", "noopener,noreferrer");
      return;
    }

    // Snap smoothly to nearest left or right edge
    const midX = window.innerWidth / 2;
    const snappedX =
      pos.x + BUBBLE_SIZE / 2 < midX
        ? EDGE_MARGIN
        : Math.max(EDGE_MARGIN, window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN);
    const snapped = clampPos(snappedX, pos.y);
    setPos(snapped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped));
    } catch {
      // ignore
    }
  };

  const isOnLeft = typeof window !== "undefined" ? pos.x + BUBBLE_SIZE / 2 < window.innerWidth / 2 : false;
  const labelVisible = !dragging && (hovered || showHint) && Boolean(config.label);

  return (
    <>
      <style>{`
        @keyframes waFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes waPulseRing {
          0% { transform: scale(1); opacity: 0.65; }
          75% { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes waLabelPop {
          0% { opacity: 0; transform: translateY(4px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        role="button"
        tabIndex={0}
        aria-label={config.label || "Join WhatsApp Group"}
        title={config.label || "Join WhatsApp Group"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            window.open(config.groupLink, "_blank", "noopener,noreferrer");
          }
        }}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          zIndex: 9990,
          touchAction: "none",
          userSelect: "none",
          cursor: dragging ? "grabbing" : "grab",
          transition: dragging
            ? "none"
            : "left 0.36s cubic-bezier(0.22, 1, 0.36, 1), top 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Inner float wrapper */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            animation: dragging ? "none" : "waFloat 3.2s ease-in-out infinite",
            transform: dragging ? "scale(1.08)" : hovered ? "scale(1.06)" : "scale(1)",
            transition: "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Expanding pulse rings */}
          {!dragging && (
            <>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(37, 211, 102, 0.45)",
                  animation: "waPulseRing 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) infinite",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(37, 211, 102, 0.3)",
                  animation: "waPulseRing 2.4s cubic-bezier(0.2, 0.8, 0.4, 1) 1.2s infinite",
                  pointerEvents: "none",
                }}
              />
            </>
          )}

          {/* Main WhatsApp Circle */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              boxShadow: dragging
                ? "0 16px 34px rgba(18, 140, 126, 0.55), 0 0 0 3px rgba(255,255,255,0.4)"
                : "0 10px 26px rgba(18, 140, 126, 0.45), 0 0 0 2px rgba(255,255,255,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              overflow: "hidden",
            }}
          >
            {/* Subtle top gloss */}
            <div
              style={{
                position: "absolute",
                top: -10,
                left: -6,
                right: -6,
                height: "52%",
                borderRadius: "50%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0))",
                pointerEvents: "none",
              }}
            />

            {/* WhatsApp SVG Logo */}
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" style={{ position: "relative" }}>
              <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-1.984 1.422-.516.078-1.172.109-1.891-.125-.438-.141-1-.328-1.719-.641-3.016-1.312-4.984-4.359-5.141-4.562-.156-.203-1.234-1.641-1.234-3.125s.781-2.219 1.063-2.516c.281-.297.609-.375.813-.375.203 0 .406.016.578.016.188 0 .438-.078.688.531.25.609.859 2.094.938 2.25.078.156.125.344.016.547-.109.203-.156.328-.313.516-.156.188-.328.406-.469.547-.156.156-.313.328-.141.641.172.313.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.438 1.5.313.156.484.125.672-.078.188-.203.766-.891.969-1.203.203-.313.406-.266.688-.156.281.109 1.781.844 2.094 1 .313.156.516.234.594.359.078.125.078.734-.172 1.438z" />
            </svg>
          </div>

          {/* Animated Tooltip Pill */}
          {labelVisible && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                ...(isOnLeft ? { left: BUBBLE_SIZE + 10 } : { right: BUBBLE_SIZE + 10 }),
                background: "rgba(15, 23, 42, 0.92)",
                color: "#ffffff",
                padding: "7px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: "nowrap",
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(37, 211, 102, 0.45)",
                pointerEvents: "none",
                animation: "waLabelPop 0.25s ease-out",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#25D366",
                  boxShadow: "0 0 6px #25D366",
                }}
              />
              {config.label}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
