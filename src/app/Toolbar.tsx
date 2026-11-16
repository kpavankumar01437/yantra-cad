import React from 'react';
import { useDesign } from '../store/designStore';
import { Icon, FeatureIcon, SketchIcon } from './icons';

type ToolButtonProps = {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabledReason?: string;
  active?: boolean;
  shortcut?: string;
};

function ToolButton({ label, icon, onClick, disabledReason, active }: ToolButtonProps) {
  const blocked = Boolean(disabledReason);
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''} ${blocked ? 'is-disabled' : ''}`}
      onClick={blocked ? undefined : onClick}
      title={blocked ? disabledReason : label}
    >
      {icon ? <span className="tool-icon">{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tool-group">
      <div className="tool-group-body">{children}</div>
      <div className="tool-group-label">{label}</div>
    </div>
  );
}

const KERNEL_NOTE = 'Needs the B-rep kernel — not in the browser-side preview build';

export function Toolbar() {
  const workspace = useDesign((s) => s.workspace);
  const startCommand = useDesign((s) => s.startCommand);
  const deleteSelection = useDesign((s) => s.deleteSelection);
  const sketchSession = useDesign((s) => s.sketchSession);
  const setSketchTool = useDesign((s) => s.setSketchTool);
  const finishSketch = useDesign((s) => s.finishSketch);
  const setWorkspace = useDesign((s) => s.setWorkspace);
  const selection = useDesign((s) => s.selection);

  if (workspace === 'sketch') {
    const sketchName = sketchSession
      ? `Sketch session · ${sketchSession.tool}`
      : 'No sketch open';
    return (
      <div className="toolbar">
        <div className="toolbar-title">
          <SketchIcon size={14} />
          <span>{sketchName}</span>
        </div>
        <Group label="Draw">
          <ToolButton
            label="Rectangle"
            icon={<Icon.Sketch />}
            active={sketchSession?.tool === 'rect'}
            onClick={() => setSketchTool('rect')}
            disabledReason={sketchSession ? undefined : 'Create or open a sketch first'}
          />
          <ToolButton
            label="Circle"
            icon={<Icon.Shell />}
            active={sketchSession?.tool === 'circle'}
            onClick={() => setSketchTool('circle')}
            disabledReason={sketchSession ? undefined : 'Create or open a sketch first'}
          />
          <ToolButton
            label="Line"
            icon={<Icon.Move />}
            active={sketchSession?.tool === 'line'}
            onClick={() => setSketchTool('line')}
            disabledReason={sketchSession ? undefined : 'Create or open a sketch first'}
          />
        </Group>
        <Group label="Sketch">
          <ToolButton
            label="Finish Sketch"
            onClick={() => {
              finishSketch();
              setWorkspace('design');
            }}
            disabledReason={sketchSession ? undefined : 'Create or open a sketch first'}
          />
          <ToolButton
            label="Back to Design"
            onClick={() => {
              finishSketch();
              setWorkspace('design');
            }}
          />
        </Group>
        <span className="toolbar-spacer" />
        <div className="toolbar-note">
          {sketchSession ? 'Click to place points · Esc clears · Enter ends the chain' : 'Design → New Sketch'}
        </div>
      </div>
    );
  }

  if (workspace !== 'design') {
    return (
      <div className="toolbar">
        <div className="toolbar-title">
          <Icon.Layers size={14} />
          <span>{workspace} workspace</span>
        </div>
        <span className="toolbar-spacer" />
        <div className="toolbar-note">This workspace arrives with its engine</div>
      </div>
    );
  }

  const bodySelected = selection.some((s) => s.kind === 'body');

  return (
    <div className="toolbar">
      <Group label="Create">
        <ToolButton label="New Sketch" icon={<SketchIcon />} onClick={() => startCommand('newSketch')} />
        <ToolButton label="Extrude" icon={<FeatureIcon kind="extrude" />} onClick={() => startCommand('extrude')} />
        <ToolButton label="Revolve" disabledReason={KERNEL_NOTE} />
        <ToolButton label="Sweep" disabledReason={KERNEL_NOTE} />
        <ToolButton label="Loft" disabledReason={KERNEL_NOTE} />
        <ToolButton label="Hole" disabledReason={KERNEL_NOTE} />
      </Group>
      <Group label="Modify">
        <ToolButton
          label="Fillet"
          icon={<FeatureIcon kind="fillet" />}
          onClick={() => startCommand('fillet')}
          disabledReason={bodySelected ? undefined : 'Select a body first'}
        />
        <ToolButton
          label="Shell"
          icon={<FeatureIcon kind="shell" />}
          onClick={() => startCommand('shell')}
          disabledReason={bodySelected ? undefined : 'Select a body first'}
        />
        <ToolButton
          label="Move / Copy"
          icon={<FeatureIcon kind="move" />}
          onClick={() => startCommand('move')}
          disabledReason={bodySelected ? undefined : 'Select a body first'}
        />
        <ToolButton label="Combine" disabledReason={KERNEL_NOTE} />
        <ToolButton
          label="Delete"
          onClick={deleteSelection}
          disabledReason={selection.length ? undefined : 'Nothing selected'}
        />
      </Group>
      <Group label="Assemble">
        <ToolButton label="New Component" disabledReason="Assemblies arrive with the assembly engine" />
        <ToolButton label="Joint" icon={<Icon.Joint />} disabledReason="Joints are read-only in this preview" />
        <ToolButton label="Motion Study" disabledReason="Kinematics arrives with the assembly engine" />
      </Group>
      <Group label="Inspect">
        <ToolButton label="Measure" disabledReason="Measures arrive with the inspection tools" />
        <ToolButton label="Section" disabledReason="Section analysis is not in this preview" />
      </Group>
      <span className="toolbar-spacer" />
    </div>
  );
}
