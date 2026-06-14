/**
 * Consty logo components.
 *
 * Renders the real Consty brand mark (public/consty-mark.png — the hexagonal
 * "C", transparent background so it sits cleanly on any surface). Aliases are
 * exported for older imports so the app can be rebranded without a broad
 * internal component rename in one pass.
 */
import Image from 'next/image';

export function ConstyIcon({ size = 32 }) {
  const px = typeof size === 'number' ? size : 32;

  return (
    <Image
      src="/consty-mark.png"
      alt="Consty"
      width={px}
      height={px}
      priority
      style={{ width: px, height: px, objectFit: 'contain' }}
    />
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
