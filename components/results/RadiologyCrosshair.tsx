"use client";

interface RadiologyCrosshairProps {
  position: { x: number; y: number } | null;
  label: string;
}

export const RadiologyCrosshair = ({ position, label }: RadiologyCrosshairProps) => {
  if (!position) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "1px",
          background: "rgba(236, 253, 245, 0.2)",
          transform: `translate3d(0, ${position.y}px, 0)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "1px",
          background: "rgba(236, 253, 245, 0.2)",
          transform: `translate3d(${position.x}px, 0, 0)`,
          pointerEvents: "none",
        }}
      />
      <div
        className="reading"
        style={{
          position: "absolute",
          fontSize: "10px",
          opacity: 0.6,
          transform: `translate3d(${position.x + 10}px, ${position.y + 10}px, 0)`,
          pointerEvents: "none",
        }}
      >
        {label}
      </div>
    </>
  );
};
