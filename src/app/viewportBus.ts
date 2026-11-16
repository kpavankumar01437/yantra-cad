import type { ViewName } from '../viewport/SceneManager';

/** Bridges global keyboard shortcuts to the live viewport instance. */
export const viewportBus: {
  fit?: () => void;
  view?: (view: ViewName) => void;
} = {};
