'use client';

/**
 * Animated Background for Auth Pages
 * Futuristic floating orbs + gradient waves with subtle motion
 * Theme-aware: adapts to light and dark color modes
 */
export default function AnimatedAuthBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 dark:from-gray-950 dark:via-slate-900 dark:to-gray-950">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.10),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.10),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.15),transparent_50%)]" />

      {/* Animated grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] dark:opacity-[0.03] text-muted-foreground dark:text-white" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float-medium" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl animate-float-reverse" />

      {/* Particle field SVG */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="particleGlow">
            <stop offset="0%" stopColor="rgba(99,102,241,0.6)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </radialGradient>
        </defs>
        {/* Floating particles */}
        <circle cx="10%" cy="20%" r="2" fill="rgba(99,102,241,0.4)" className="animate-particle-1" />
        <circle cx="80%" cy="15%" r="1.5" fill="rgba(59,130,246,0.3)" className="animate-particle-2" />
        <circle cx="25%" cy="70%" r="2.5" fill="rgba(139,92,246,0.35)" className="animate-particle-3" />
        <circle cx="70%" cy="60%" r="1.8" fill="rgba(99,102,241,0.3)" className="animate-particle-4" />
        <circle cx="50%" cy="10%" r="1.2" fill="rgba(59,130,246,0.4)" className="animate-particle-5" />
        <circle cx="90%" cy="80%" r="2" fill="rgba(139,92,246,0.25)" className="animate-particle-2" />
        <circle cx="15%" cy="85%" r="1.5" fill="rgba(59,130,246,0.35)" className="animate-particle-4" />
        <circle cx="60%" cy="35%" r="1" fill="rgba(99,102,241,0.3)" className="animate-particle-1" />

        {/* Connection lines */}
        <line x1="10%" y1="20%" x2="25%" y2="70%" stroke="rgba(99,102,241,0.06)" strokeWidth="0.5" />
        <line x1="80%" y1="15%" x2="70%" y2="60%" stroke="rgba(59,130,246,0.06)" strokeWidth="0.5" />
        <line x1="50%" y1="10%" x2="60%" y2="35%" stroke="rgba(139,92,246,0.06)" strokeWidth="0.5" />
      </svg>

      {/* Gradient wave at bottom */}
      <svg className="absolute bottom-0 left-0 w-full h-48 opacity-30" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="waveGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(59,130,246,0.4)" />
            <stop offset="50%" stopColor="rgba(99,102,241,0.3)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.4)" />
          </linearGradient>
        </defs>
        <path fill="url(#waveGradient)" className="animate-wave">
          <animate
            attributeName="d"
            dur="12s"
            repeatCount="indefinite"
            values="
              M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,197.3C672,213,768,235,864,229.3C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L0,320Z;
              M0,224L48,229.3C96,235,192,245,288,250.7C384,256,480,256,576,240C672,224,768,192,864,186.7C960,181,1056,203,1152,213.3C1248,224,1344,224,1392,224L1440,224L1440,320L0,320Z;
              M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,197.3C672,213,768,235,864,229.3C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L0,320Z
            "
          />
        </path>
      </svg>
    </div>
  );
}
