import React from "react";

export default function ProgressBar({ percent }) {
  return (
    <div className="w-full bg-surface-elevated rounded-full overflow-hidden h-2">
      <div
        className="h-full bg-accent transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, percent || 0))}%` }}
      />
    </div>
  );
}
