import { useEffect } from 'react';
import { addSketchEntity } from '../services/actions';
import { commitActiveCommand, redo, undo } from '../services/commands';
import { deleteSelection } from '../services/actions';
import { useCommandStore } from '../stores/commandStore';
import { useDesignStore } from '../stores/designStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import { newId } from '../model/doc';
import { BrowserPanel } from './BrowserPanel';
import { CommandPanel } from './CommandPanel';
import { ContextMenu } from './ContextMenu';
import { Dialogs } from './Dialogs';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { Viewport3D } from './Viewport3D';
import { WorkspacePlaceholder } from './WorkspacePlaceholder';
import { WorkspaceTabs } from './WorkspaceTabs';

function finishSketchChain() {
  const session = useUiStore.getState().sketchSession;
  if (!session) return;
  const { pendingPoints, tool, sketchId } = session;
  if (tool === 'polyline' && pendingPoints.length >= 2) {
    addSketchEntity(sketchId, {
      id: newId('e'),
      kind: 'polyline',
      points: pendingPoints,
      closed: pendingPoints.length >= 3,
    });
  }
  useUiStore.getState().patchSketchSession({ pendingPoints: [], cursor: null });
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      const typing =
        Boolean(element) &&
        (element!.tagName === 'INPUT' || element!.tagName === 'TEXTAREA' || element!.tagName === 'SELECT' || element!.isContentEditable);
      const ui = useUiStore.getState();
      const command = useCommandStore.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (typing) {
        if (event.key === 'Escape') (event.target as HTMLElement).blur();
        return;
      }

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        useDesignStore.getState().saveNow();
        ui.notify('Design saved locally', 'ok');
        return;
      }
      if (mod) return;

      if (event.key === 'Escape') {
        if (ui.dialog) {
          ui.setDialog(null);
          return;
        }
        if (ui.contextMenu) {
          ui.closeContextMenu();
          return;
        }
        if (command.active) {
          command.cancel();
          return;
        }
        if (ui.sketchSession) {
          ui.patchSketchSession({ pendingPoints: [], cursor: null });
          return;
        }
        useSelectionStore.getState().clear();
        return;
      }

      if (event.key === 'Enter') {
        if (command.active) {
          event.preventDefault();
          commitActiveCommand();
          return;
        }
        finishSketchChain();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = useSelectionStore.getState().selection;
        if (selection.length) {
          event.preventDefault();
          deleteSelection(selection);
        }
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        window.dispatchEvent(new CustomEvent('yantra:fit'));
        return;
      }

      const views: Record<string, 'iso' | 'front' | 'top' | 'right'> = { '1': 'iso', '2': 'front', '3': 'top', '4': 'right' };
      const view = views[event.key];
      if (view) window.dispatchEvent(new CustomEvent('yantra:view', { detail: view }));
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useAutosave() {
  useEffect(() => {
    let timer = 0;
    const unsubscribe = useDesignStore.subscribe((state, previous) => {
      if (state.design === previous.design) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => useDesignStore.getState().saveNow(), 900);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

function Toast() {
  const toast = useUiStore((state) => state.toast);
  const clear = useUiStore((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clear, 2600);
    return () => window.clearTimeout(timer);
  }, [toast, clear]);

  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-9 left-1/2 z-50 -translate-x-1/2 rounded border px-3 py-1.5 text-xs shadow-lg ${
        toast.tone === 'ok'
          ? 'border-ok/40 bg-[#10231c] text-emerald-200'
          : toast.tone === 'error'
            ? 'border-danger/50 bg-[#291317] text-red-200'
            : 'border-line bg-ink-850 text-slate-300'
      }`}
      onClick={clear}
      role="status"
    >
      {toast.message}
    </div>
  );
}

export default function App() {
  const workspace = useUiStore((state) => state.workspace);
  const browserOpen = useUiStore((state) => state.browserOpen);
  const propertiesOpen = useUiStore((state) => state.propertiesOpen);
  const active = useCommandStore((state) => state.active);

  useHotkeys();
  useAutosave();

  const canvasWorkspace = workspace === 'design' || workspace === 'sketch';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-950 text-slate-200">
      <div className="h-[46px] flex-none">
        <TopBar />
      </div>
      <div className="h-[30px] flex-none">
        <WorkspaceTabs />
      </div>
      <div className="h-[62px] flex-none">
        <Toolbar />
      </div>

      <div className="flex min-h-0 flex-1">
        {browserOpen ? <BrowserPanel /> : null}
        <main className="relative min-w-0 flex-1 bg-ink-950">
          {canvasWorkspace ? <Viewport3D /> : <WorkspacePlaceholder />}
        </main>
        {propertiesOpen ? active ? <CommandPanel /> : <PropertiesPanel /> : null}
      </div>

      <Timeline />
      <div className="h-[24px] flex-none">
        <StatusBar />
      </div>

      <ContextMenu />
      <Dialogs />
      <Toast />
    </div>
  );
}
