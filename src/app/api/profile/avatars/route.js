import { NextResponse } from 'next/server';

/**
 * GET /api/profile/avatars — Get prebuilt avatar list + external avatar APIs
 * Returns 200 avatar IDs based on DiceBear API
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const style = searchParams.get('style') || 'all';

  // DiceBear avatar styles
  const styles = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
    'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
    'croodles', 'croodles-neutral', 'fun-emoji', 'icons', 'identicon',
    'initials', 'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
    'notionists', 'notionists-neutral', 'open-peeps', 'personas',
    'pixel-art', 'pixel-art-neutral', 'rings', 'shapes', 'thumbs',
  ];

  // Generate 200 avatar entries across styles
  const avatars = [];
  const seeds = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
    'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'ace', 'blaze', 'coral', 'dawn', 'echo', 'frost', 'glow', 'haze',
  ];

  let id = 1;
  for (const s of styles) {
    if (style !== 'all' && s !== style) continue;
    for (const seed of seeds.slice(0, style === 'all' ? 8 : 24)) {
      avatars.push({
        id: `${s}-${seed}`,
        style: s,
        seed,
        url: `https://api.dicebear.com/9.x/${s}/svg?seed=${seed}&size=128`,
        thumbnail: `https://api.dicebear.com/9.x/${s}/svg?seed=${seed}&size=64`,
      });
      id++;
      if (avatars.length >= 200) break;
    }
    if (avatars.length >= 200) break;
  }

  return NextResponse.json({
    success: true,
    data: avatars,
    styles,
    total: avatars.length,
  });
}
