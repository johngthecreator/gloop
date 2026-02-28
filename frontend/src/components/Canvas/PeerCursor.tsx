interface PeerCursorProps {
  position: { x: number; y: number } | null;
  label?: string;
  color?: string;
}

export default function PeerCursor({
  position,
  label = "Peer",
  color = "#6366f1",
}: PeerCursorProps) {
  if (!position) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 9999,
        pointerEvents: "none",
        transform: "translate(-4px, -4px)",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
          border: "2px solid white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 14,
          top: -2,
          fontSize: 11,
          fontWeight: 600,
          color: "white",
          backgroundColor: color,
          padding: "1px 6px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          lineHeight: "16px",
        }}
      >
        {label}
      </span>
    </div>
  );
}
