// DAOIP-5 project IDs for SCF look like `daoip-5:scf:project:stellar_light`.
// Pages use the suffix in URLs (/system/scf/project/stellar_light); APIs accept either form.
export const SCF_PROJECT_PREFIX = 'daoip-5:scf:project:';

export function toProjectId(raw: string): string {
  const v = decodeURIComponent(raw).trim();
  return v.startsWith(SCF_PROJECT_PREFIX) ? v : `${SCF_PROJECT_PREFIX}${v}`;
}

export function projectPath(projectId: string | null | undefined): string | null {
  if (!projectId) return null;
  const suffix = projectId.startsWith(SCF_PROJECT_PREFIX)
    ? projectId.slice(SCF_PROJECT_PREFIX.length)
    : projectId;
  return `/system/scf/project/${encodeURIComponent(suffix)}`;
}
