export function ClearSightLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="cs-lens" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="0.55" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="cs-prism" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#cs-lens)" fillOpacity="0.18" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="13.25" stroke="url(#cs-lens)" strokeOpacity="0.45" strokeWidth="1.5" />
      <path
        d="M24 11C17.925 11 13 15.925 13 22C13 28.075 17.925 33 24 33C30.075 33 35 28.075 35 22C35 15.925 30.075 11 24 11Z"
        stroke="url(#cs-lens)"
        strokeWidth="2.2"
      />
      <path
        d="M18 18L30 30M30 18L18 30"
        stroke="url(#cs-prism)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="22" r="4.5" fill="url(#cs-lens)" />
      <circle cx="24" cy="22" r="2" fill="#ECFEFF" fillOpacity="0.95" />
    </svg>
  )
}
