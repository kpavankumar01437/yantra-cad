import type { Design } from '../types';

const KEY = 'yantracad.versions.v1';
const LIMIT = 10;

export type VersionEntry = {
  id: string;
  name: string;
  savedAt: number;
  design: Design;
};

export function listVersions(): VersionEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VersionEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: VersionEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    /* storage unavailable */
  }
}

export function saveVersion(design: Design, name?: string): VersionEntry[] {
  const entries = listVersions();
  const entry: VersionEntry = {
    id: `v_${Date.now().toString(36)}`,
    name: name ?? `Version ${entries.length + 1}`,
    savedAt: Date.now(),
    design: structuredClone(design),
  };
  const next = [entry, ...entries].slice(0, LIMIT);
  write(next);
  return next;
}

export function deleteVersion(id: string): VersionEntry[] {
  const next = listVersions().filter((entry) => entry.id !== id);
  write(next);
  return next;
}

export function formatWhen(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleString();
}
