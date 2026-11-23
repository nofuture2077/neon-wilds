/**
 * Minimal, allocation-light behaviour tree runtime (AI.md §2.6).
 * Trees are plain data; per-agent running state lives in a serialisable
 * `Record<string, number>` keyed by node path, so trees survive save/load.
 */
export type BtStatus = 'success' | 'failure' | 'running';

export type BtNode =
  | { type: 'sequence'; children: BtNode[] }
  | { type: 'selector'; children: BtNode[] }
  | { type: 'condition'; name: string; params?: Record<string, number | string> }
  | { type: 'action'; name: string; params?: Record<string, number | string> };

export interface BtHost<C> {
  condition(name: string, params: Record<string, number | string>, ctx: C): boolean;
  /** Actions may keep state in `memory` under `key` (e.g. timers). */
  action(name: string, params: Record<string, number | string>, ctx: C, memory: Record<string, number>, key: string): BtStatus;
}

/** Tick a tree once. Sequences and selectors remember their running child. */
export function tickTree<C>(node: BtNode, host: BtHost<C>, ctx: C, memory: Record<string, number>, path = 'r'): BtStatus {
  switch (node.type) {
    case 'condition':
      return host.condition(node.name, node.params ?? {}, ctx) ? 'success' : 'failure';
    case 'action':
      return host.action(node.name, node.params ?? {}, ctx, memory, path);
    case 'sequence':
    case 'selector': {
      const isSeq = node.type === 'sequence';
      let i = memory[path] ?? 0;
      for (; i < node.children.length; i++) {
        const status = tickTree(node.children[i]!, host, ctx, memory, `${path}.${i}`);
        if (status === 'running') {
          memory[path] = i;
          return 'running';
        }
        if (isSeq && status === 'failure') {
          delete memory[path];
          return 'failure';
        }
        if (!isSeq && status === 'success') {
          delete memory[path];
          return 'success';
        }
      }
      delete memory[path];
      return isSeq ? 'success' : 'failure';
    }
  }
}

export const seq = (...children: BtNode[]): BtNode => ({ type: 'sequence', children });
export const sel = (...children: BtNode[]): BtNode => ({ type: 'selector', children });
export const act = (name: string, params?: Record<string, number | string>): BtNode => ({ type: 'action', name, ...(params ? { params } : {}) });
export const cond = (name: string, params?: Record<string, number | string>): BtNode => ({ type: 'condition', name, ...(params ? { params } : {}) });
