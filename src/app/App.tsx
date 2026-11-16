import { useEffect } from 'react';
import { STORAGE_KEY, useDesign } from '../store/designStore';
import type { Doc } from '../types';
import type { ViewName } from '../viewport/SceneManager';
import { BrowserPanel } from './BrowserPanel';
import { CommandPanel } from './CommandPanel';
import { LayerPlaceholder } from './LayerPlaceholder';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { Viewport } from './Viewport';
import { WorkspaceTabs } from './WorkspaceTabs';
import { viewportBus } from './viewportBus';

const VIEW_KEYS: Record<string, ViewName> = {
  '1': 'iso',
  '2': 'front',
  '3': 'top',
  '4': 'right',
};

function useGlobalShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable),
      );
      if (isTyping) {
        if (event.key === 'Escape') target?.blur();
        return;
      }

      const state = useDesign.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.doc));
          state.markSaved();
        } catch {
          /* storage unavailable */
        }
        return;
      }
      if (event.key === 'Escape') {
        if (state.cmd) state.cancelCommand();
        else if (state.sketchSession) state.clearSketchPending();
        else state.select(null);
        return;
      }
      if (event.key === 'Enter') {
        if (state.cmd) state.commitCommand();
        else if (state.sketchSession) state.clearSketchPending();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selection.length) {
          event.preventDefault();
          state.deleteSelection();
        }
        return;
      }
      if (event.key.toLowerCase() === 'f' || event.key === 'Home') {
        viewportBus.fit?.();
        return;
      }
      if (VIEW_KEYS[event.key]) viewportBus.view?.(VIEW_KEYS[event.key]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

function useAutosave(doc: Doc) {
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
        useDesign.getState().markSaved();
      } catch {
        /* storage unavailable */
      }
    }, 700);
    return () => window.clearTimeout(handle);
  }, [doc]);
}

export function App() {
  const workspace = useDesign((s) => s.workspace);
  const cmd = useDesign((s) => s.cmd);
  const doc = useDesign((s) => s.doc);
  const showViewport = workspace === 'design' || workspace === 'sketch';

  useGlobalShortcuts();
  useAutosave(doc);

  return (
    <div className="app">
      <TopBar />
      <WorkspaceTabs />
      <Toolbar />
      <main className="main">
        <BrowserPanel />
        <section className="stage">{showViewport ? <Viewport /> : <LayerPlaceholder />}</section>
        {cmd ? <CommandPanel /> : <PropertiesPanel />}
      </main>
      <Timeline />
      <StatusBar />
    </div>
  );
}
