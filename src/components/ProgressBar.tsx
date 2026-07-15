interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = 'var(--accent)', height = 6 }: ProgressBarProps) {
  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: height / 2,
      background: 'var(--input-bg)',
      overflow: 'hidden',
    }}>
      <div style={{
        // Animate transform (GPU-composited) rather than width, so the fill
        // glides smoothly instead of pixel-stepping/reflowing each frame. The
        // parent's rounded overflow:hidden clips this into a clean bar.
        width: '100%',
        height: '100%',
        background: color,
        transformOrigin: 'left center',
        transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})`,
        transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
      }} />
    </div>
  );
}
