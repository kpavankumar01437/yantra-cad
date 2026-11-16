import { create } from 'zustand';

export type CommandId = 'newSketch' | 'extrude' | 'fillet' | 'shell' | 'move';

export type ActiveCommand = {
  id: CommandId;
  inputs: Record<string, string>;
  editingFeatureId?: string;
  startedAt: number;
};

type CommandState = {
  active: ActiveCommand | null;
  /** Field-level validation messages plus the reserved `_form` key. */
  errors: Record<string, string>;
  start: (command: ActiveCommand) => void;
  setInput: (key: string, value: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  cancel: () => void;
};

export const useCommandStore = create<CommandState>()((set) => ({
  active: null,
  errors: {},

  start: (command) => set({ active: command, errors: {} }),

  setInput: (key, value) =>
    set((state) =>
      state.active
        ? {
            active: { ...state.active, inputs: { ...state.active.inputs, [key]: value } },
            errors: { ...state.errors, [key]: '', _form: '' },
          }
        : state,
    ),

  setErrors: (errors) => set({ errors }),

  cancel: () => set({ active: null, errors: {} }),
}));
