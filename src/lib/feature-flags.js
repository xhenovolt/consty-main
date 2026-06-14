/**
 * CONSTY feature flags (client-safe).
 *
 * The DB table `feature_flags` is the authoritative, runtime-toggleable store
 * (seeded in migration 0009) and should be read server-side / by a future admin
 * toggle UI. These defaults mirror that seed so the navigation can hide
 * inherited Jeton modules synchronously without a round-trip. When an admin
 * toggle UI lands, it should override these via the API.
 *
 * Single-tenant: one flag set per deployment.
 */
export const DEFAULT_FEATURE_FLAGS = {
  // CONSTY project-management domain (ON)
  'module.projects': true,
  'module.resources': true,
  'module.procurement': true,
  'module.finance': true,
  'module.documents': true,
  'module.reports': true,
  // Inherited Jeton modules (OFF — clearly outside the PM domain)
  'module.designs': false,
  'module.pricing': false,
  'module.intelligence': false,
  'module.drais': false,
};

export function isModuleEnabled(key, flags = DEFAULT_FEATURE_FLAGS) {
  if (!key) return true;            // untagged nav items are always allowed
  return flags[key] !== false;      // default-on unless explicitly disabled
}
