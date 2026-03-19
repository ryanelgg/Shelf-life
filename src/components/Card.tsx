import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className = '', style, onClick }: CardProps) {
  return (
    <div
      className={`card-component ${className}`}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: 'var(--card-border)',
        borderRadius: 'var(--card-radius)',
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
