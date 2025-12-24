import React from 'react';

interface NeonCardProps {
  title?: string;
  sectionLabel?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  colSpan?: 4 | 6 | 12;
}

export function NeonCard({
  title,
  sectionLabel,
  children,
  className = '',
  onClick,
  colSpan,
}: NeonCardProps) {
  const clickableClasses = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`dashboard-card ${clickableClasses} ${className}`}
      onClick={onClick}
      style={{ isolation: 'isolate' }}
    >
      {sectionLabel && (
        <p className="neon-section-label">{sectionLabel}</p>
      )}
      {title && (
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">{title}</h2>
      )}
      <div className="dashboard-card-content">
        {children}
      </div>
    </div>
  );
}
