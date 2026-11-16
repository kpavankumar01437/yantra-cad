import {
  Box,
  Circle,
  CircleDot,
  Check,
  Component,
  Link2,
  Layers,
  Move,
  PenTool,
  Play,
  Ruler,
  Scissors,
  Spline,
  Square,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { addConstraint, deleteSelection } from '../services/actions';
import { startCommand } from '../services/commands';
import { useCommandStore } from '../stores/commandStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useUiStore } from '../stores/uiStore';
import type { ConstraintType } from '../types';

function Tool({
  label,
  icon,
  onClick,
  active,
  disabledReason,
}: {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      className={`tool-btn ${active ? 'tool-btn-active' : ''}`}
      title={disabledReason ?? label}
      disabled={Boolean(disabledReason)}
      onClick={onClick}
    >
      {icon ? <span className="grid h-4 place-items-center">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-center border-r border-line/70 px-1.5">
      <div className="flex items-center gap-0.5">{children}</div>
      <div className="pt-px text-center text-[8px] uppercase leading-[10px] tracking-[0.08em] text-slate-600">{label}</div>
    </div>
  );
}

const KERNEL_NOTE = 'Needs a B-rep kernel — not part of this preview build';

export function Toolbar() {
  const workspace = useUiStore((state) => state.workspace);
  const session = useUiStore((state) => state.sketchSession);
  const setWorkspace = useUiStore((state) => state.setWorkspace);
  const endSketchSession = useUiStore((state) => state.endSketchSession);
  const patchSession = useUiStore((state) => state.patchSketchSession);
  const notify = useUiStore((state) => state.notify);
  const selection = useSelectionStore((state) => state.selection);
  const active = useCommandStore((state) => state.active);

  const hasGeometry = selection.some((s) => s.kind === 'body' || s.kind === 'face' || s.kind === 'edge');

  if (workspace === 'sketch' && session) {
    const entitySelection = selection.filter((s) => s.kind === 'sketchEntity');
    const entityA = entitySelection[0]?.id;
    const entityB = entitySelection[1]?.id;

    const applyConstraint = (type: ConstraintType) => {
      const error = addConstraint(session.sketchId, type, entityA ?? '', entityB);
      notify(error ?? `${type} constraint applied`, error ? 'error' : 'ok');
    };

    return (
      <div className="flex items-stretch gap-1 overflow-x-auto border-b border-line bg-ink-850 px-2 py-1">
        <div className="flex items-center gap-1.5 border-r border-line px-2 text-2xs text-slate-400">
          <PenTool size={13} className="text-warn" />
          Sketch session
        </div>

        <Group label="Draw">
          <Tool label="Select" icon={<Move size={14} />} active={session.tool === 'select'} onClick={() => patchSession({ tool: 'select', pendingPoints: [] })} />
          <Tool label="Line" icon={<PenTool size={14} />} active={session.tool === 'line'} onClick={() => patchSession({ tool: 'line', pendingPoints: [] })} />
          <Tool label="Rect" icon={<Square size={14} />} active={session.tool === 'rectangle'} onClick={() => patchSession({ tool: 'rectangle', pendingPoints: [] })} />
          <Tool label="Circle" icon={<Circle size={14} />} active={session.tool === 'circle'} onClick={() => patchSession({ tool: 'circle', pendingPoints: [] })} />
          <Tool label="Polyline" icon={<Spline size={14} />} active={session.tool === 'polyline'} onClick={() => patchSession({ tool: 'polyline', pendingPoints: [] })} />
        </Group>

        <Group label="Constraints">
          <Tool label="Horiz" onClick={() => applyConstraint('horizontal')} disabledReason={entityA ? undefined : 'Select a line in the sketch first'} />
          <Tool label="Vert" onClick={() => applyConstraint('vertical')} disabledReason={entityA ? undefined : 'Select a line in the sketch first'} />
          <Tool label="Coincident" icon={<CircleDot size={14} />} onClick={() => applyConstraint('coincident')} disabledReason={entityA ? undefined : 'Select a line first'} />
          <Tool label="Parallel" onClick={() => applyConstraint('parallel')} disabledReason={entityA && entityB ? undefined : 'Select two lines'} />
          <Tool label="Perp" onClick={() => applyConstraint('perpendicular')} disabledReason={entityA && entityB ? undefined : 'Select two lines'} />
        </Group>

        <Group label="Sketch">
          <Tool
            label="Finish"
            icon={<Check size={14} />}
            onClick={() => {
              endSketchSession();
              setWorkspace('design');
            }}
          />
        </Group>

        <span className="ml-auto self-center px-2 text-3xs text-slate-500">
          Click to place points · Esc clears · Enter ends a chain
        </span>
      </div>
    );
  }

  if (workspace !== 'design') {
    return (
      <div className="flex items-stretch gap-1 border-b border-line bg-ink-850 px-2 py-1">
        <div className="flex items-center gap-1.5 px-2 text-2xs text-slate-400">
          <Layers size={13} />
          {workspace} workspace
        </div>
        <span className="ml-auto self-center px-2 text-3xs text-slate-500">This workspace arrives with its engine</span>
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto border-b border-line bg-ink-850 px-2 py-1">
      <Group label="Create">
        <Tool label="New Sketch" icon={<PenTool size={14} />} onClick={() => startCommand('newSketch')} active={active?.id === 'newSketch'} />
        <Tool label="Extrude" icon={<Box size={14} />} onClick={() => startCommand('extrude')} active={active?.id === 'extrude'} />
        <Tool label="Revolve" icon={<Circle size={14} />} disabledReason={KERNEL_NOTE} />
        <Tool label="Sweep" icon={<Spline size={14} />} disabledReason={KERNEL_NOTE} />
        <Tool label="Loft" icon={<Layers size={14} />} disabledReason={KERNEL_NOTE} />
        <Tool label="Hole" icon={<CircleDot size={14} />} disabledReason="Use Extrude → Cut for through holes" />
      </Group>

      <Group label="Modify">
        <Tool
          label="Fillet"
          icon={<Scissors size={14} />}
          onClick={() => startCommand('fillet')}
          active={active?.id === 'fillet'}
          disabledReason={hasGeometry ? undefined : 'Select a body first'}
        />
        <Tool
          label="Shell"
          icon={<Layers size={14} />}
          onClick={() => startCommand('shell')}
          active={active?.id === 'shell'}
          disabledReason={hasGeometry ? undefined : 'Select a body first'}
        />
        <Tool
          label="Move"
          icon={<Move size={14} />}
          onClick={() => startCommand('move')}
          active={active?.id === 'move'}
          disabledReason={hasGeometry ? undefined : 'Select a body first'}
        />
        <Tool
          label="Delete"
          icon={<Trash2 size={14} />}
          onClick={() => deleteSelection(useSelectionStore.getState().selection)}
          disabledReason={selection.length ? undefined : 'Nothing selected'}
        />
      </Group>

      <Group label="Assemble">
        <Tool label="Component" icon={<Component size={14} />} disabledReason="Assembly authoring is not in this preview" />
        <Tool label="Joint" icon={<Link2 size={14} />} disabledReason="Joints are read-only in this preview" />
        <Tool label="Motion" icon={<Play size={14} />} disabledReason="Kinematics arrives with the assembly engine" />
      </Group>

      <Group label="Inspect">
        <Tool label="Measure" icon={<Ruler size={14} />} disabledReason="Measurement tool is not in this preview" />
      </Group>
    </div>
  );
}
