/**
 * Tier Indicator Icons
 * 
 * Ring Progression system for plan tier visualization.
 * These icons represent system access levels, not achievements or ranks.
 */

interface TierIconProps {
  className?: string
  size?: number
}

/**
 * Bronze Tier Icon
 * Base access level - single ring
 */
export function TierBronzeIcon({ className = '', size = 16 }: TierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="8"
        cy="8"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Silver Tier Icon
 * Expanded access level - single ring with center dot
 */
export function TierSilverIcon({ className = '', size = 16 }: TierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="8"
        cy="8"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="8"
        cy="8"
        r="1.3"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Gold Tier Icon
 * Full access level - double ring
 */
export function TierGoldIcon({ className = '', size = 16 }: TierIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="8"
        cy="8"
        r="5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="8"
        cy="8"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}










