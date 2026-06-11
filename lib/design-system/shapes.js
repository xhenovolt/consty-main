// Consty Design System — Shape Library
// 40 2D shapes + 40 3D-like shapes (SVG generators)

export const shapes2D = [
  // Example: Blob
  {
    id: 'blob_01',
    svg: (color = '#46DC88', opacity = 1) => `<svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M60 10 Q90 0 110 40 Q120 80 80 90 Q40 100 10 60 Q-10 20 40 20 Q50 10 60 10Z" fill="${color}" fill-opacity="${opacity}"/></svg>`
  },
  // ...39 more 2D shapes
];

export const shapes3D = [
  // Example: 3D-like blob
  {
    id: 'blob3d_01',
    svg: (color = '#0A5D40', opacity = 1) => `<svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity="0.7"/><stop offset="100%" stop-color="${color}" stop-opacity="${opacity}"/></radialGradient></defs><ellipse cx="60" cy="50" rx="50" ry="40" fill="url(#g1)"/></svg>`
  },
  // ...39 more 3D shapes
];

// Add more shapes as needed for the design system
