/**
 * Consty logo components.
 * Aliases are exported for older imports so the app can be rebranded
 * without forcing a broad internal component rename in one pass.
 */

export function ConstyIcon({ size = 32 }) {
  const px = typeof size === 'number' ? size : 32;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="consty-logo-grad" x1="14" y1="12" x2="86" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="55%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
      </defs>

      <path
        d="M74 22C67 17 58 14 48 14C27 14 12 30 12 50C12 70 27 86 48 86C58 86 67 83 74 78"
        stroke="url(#consty-logo-grad)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M56 24V76"
        stroke="url(#consty-logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M42 36H68"
        stroke="url(#consty-logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M42 50H64"
        stroke="url(#consty-logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M42 64H68"
        stroke="url(#consty-logo-grad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConstyLogo({ size = 'sm' }) {
  const pxMap = { sm: 32, md: 40, lg: 48 };
  return <ConstyIcon size={pxMap[size] ?? 32} />;
}

export function ConstyLogoBrand({ showText = true, size = 'sm' }) {
  const pxMap = { sm: 32, md: 40, lg: 48 };

  return (
    <div className="flex items-center gap-2">
      <ConstyIcon size={pxMap[size] ?? 32} />
      {showText && <span className="text-sm font-bold text-foreground">Consty</span>}
    </div>
  );
}
