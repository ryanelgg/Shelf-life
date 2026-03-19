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
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        borderRadius: height / 2,
        background: color,
        transition: 'width 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
      }} />
    </div>
  );
}
