import React from 'react';

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const ChevronIcon = ({ size = 12, open = false }: IconProps & { open?: boolean }) => (
  <svg {...base(size)} className="icon chevron" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const EyeIcon = ({ size = 13, off = false }: IconProps & { off?: boolean }) => (
  <svg {...base(size)}>
    <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4z" opacity={off ? 0.35 : 1} />
    <circle cx="8" cy="8" r="1.8" opacity={off ? 0.35 : 1} />
    {off && <path d="M2.5 13.5l11-11" />}
  </svg>
);

export const UndoIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 7h6.5a3.5 3.5 0 010 7H6" />
    <path d="M5.5 4.5L3 7l2.5 2.5" />
  </svg>
);

export const RedoIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M13 7H6.5a3.5 3.5 0 000 7H10" />
    <path d="M10.5 4.5L13 7l-2.5 2.5" />
  </svg>
);

export const PlaneIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 5.5l6-3 6 3-6 3-6-3z" />
    <path d="M2 5.5v5l6 3 6-3v-5" opacity="0.55" />
  </svg>
);

export const SketchIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 12.5l7.5-7.5 2 2-7.5 7.5H2.5v-2z" />
    <path d="M11 3l1.5-1.5 2 2L13 5" />
  </svg>
);

export const ExtrudeIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 11.5l4-2 4 2 4-2v2.5l-4 2-4-2-4 2v-2.5z" opacity="0.7" />
    <path d="M2 4l4-2 4 2 4-2" />
    <path d="M6 2v9.5M10 4v9.5" opacity="0.5" />
  </svg>
);

export const FilletIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 13V6a3 3 0 013-3h7" />
    <path d="M3 3h3M13 10v3H3" opacity="0.4" />
  </svg>
);

export const ShellIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2.5 4.5h11v8h-11z" />
    <path d="M5 7h6v5.5H5" opacity="0.55" />
  </svg>
);

export const MoveIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 1.5v13M1.5 8h13" />
    <path d="M6 3.5L8 1.5l2 2M6 12.5L8 14.5l2-2M3.5 6L1.5 8l2 2M12.5 6l2 2-2 2" />
  </svg>
);

export const BodyIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 1.8l5.5 3v6.4L8 14.2 2.5 11.2V4.8L8 1.8z" />
    <path d="M2.5 4.8L8 7.8l5.5-3M8 7.8v6.4" opacity="0.5" />
  </svg>
);

export const FitIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
  </svg>
);

export const GridIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 6h12M2 10h12M6 2v12M10 2v12" />
  </svg>
);

export const CubeIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 1.8l5.5 3v6.4L8 14.2 2.5 11.2V4.8L8 1.8z" />
    <path d="M2.5 4.8L8 7.8l5.5-3M8 7.8v6.4" />
  </svg>
);

export const JointIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
  </svg>
);

export const ParameterIcon = ({ size = 13 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 13V3h4.5M4 8h4" />
    <path d="M10.5 9.5l2 3M12.5 9.5l-2 3" opacity="0.8" />
  </svg>
);

export const WarningIcon = ({ size = 12 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 2.2l6 11H2l6-11z" />
    <path d="M8 6.5v3.2M8 11.6v.1" />
  </svg>
);

export const CheckIcon = ({ size = 12 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 8.5l3.2 3L13 4.5" />
  </svg>
);

export const LayersIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8 2l6 3-6 3-6-3 6-3z" />
    <path d="M2 8l6 3 6-3M2 11l6 3 6-3" opacity="0.5" />
  </svg>
);

export const SkullIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 4h8v8H4z" />
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const Icon = {
  Chevron: ChevronIcon,
  Eye: EyeIcon,
  Undo: UndoIcon,
  Redo: RedoIcon,
  Plane: PlaneIcon,
  Sketch: SketchIcon,
  Extrude: ExtrudeIcon,
  Fillet: FilletIcon,
  Shell: ShellIcon,
  Move: MoveIcon,
  Body: BodyIcon,
  Fit: FitIcon,
  Grid: GridIcon,
  Cube: CubeIcon,
  Joint: JointIcon,
  Parameter: ParameterIcon,
  Warning: WarningIcon,
  Check: CheckIcon,
  Layers: LayersIcon,
};

export type FeatureIconProps = { kind: string; size?: number };

export function FeatureIcon({ kind, size = 13 }: FeatureIconProps) {
  if (kind === 'extrude') return <ExtrudeIcon size={size} />;
  if (kind === 'fillet') return <FilletIcon size={size} />;
  if (kind === 'shell') return <ShellIcon size={size} />;
  return <MoveIcon size={size} />;
}

export const BrandMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5l8.5 4.9v9.2L12 21.5 3.5 16.6V7.4L12 2.5z" stroke="#7cc4ff" strokeWidth="1.4" />
    <path d="M3.5 7.4L12 12.3l8.5-4.9M12 12.3v9.2" stroke="#7cc4ff" strokeWidth="1.4" opacity="0.55" />
    <circle cx="12" cy="12.3" r="1.7" fill="#7cc4ff" />
  </svg>
);
