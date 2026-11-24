import Phaser from 'phaser';
import { type GameAction, keysFor } from '../../settings';

export interface FrameInput {
  moveX: number;
  moveY: number;
  run: boolean;
  /** Pressed this frame (confirm / interact / advance dialogue). */
  confirm: boolean;
  /** Pressed this frame (pause menu). */
  pause: boolean;
  /** Pressed this frame (enter / exit vehicle). */
  action: boolean;
}

const STICK_DEADZONE = 0.2;

/**
 * Maps keyboard and gamepad to abstract per-frame intent. Gameplay code never
 * looks at physical keys, so rebinding and new devices only touch this file.
 *
 * Keyboard bindings come from settings (rebindable; arrows, Enter/Space and Esc always work).
 * Gamepad (standard mapping): left stick / d-pad move, A interacts, B or RT runs, Y enters/exits vehicles, Start pauses.
 */
export class InputMapper {
  /** Physical keys currently held (KeyboardEvent.code). */
  private readonly held = new Set<string>();
  private prevPadConfirm = false;
  private prevPadPause = false;
  // Edge-triggered actions are latched from keydown events, so presses that start and end
  // within a single frame (fast taps) are never lost.
  private latchedConfirm = false;
  private latchedPause = false;
  private latchedAction = false;
  private prevPadAction = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    // No key capture: focused DOM buttons (menus, battle) must still receive Enter/Space/arrows.
    kb.clearCaptures();
    const onKeyDown = (ev: KeyboardEvent) => {
      this.held.add(ev.code);
      if (ev.repeat) return;
      if (keysFor('interact').includes(ev.code)) this.latchedConfirm = true;
      if (keysFor('pause').includes(ev.code) || ev.code === 'Escape') this.latchedPause = true;
      if (keysFor('vehicle').includes(ev.code)) this.latchedAction = true;
    };
    const onKeyUp = (ev: KeyboardEvent) => this.held.delete(ev.code);
    const onBlur = () => this.held.clear();
    kb.on('keydown', onKeyDown);
    kb.on('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', onKeyDown);
      kb.off('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  read(): FrameInput {
    const down = (action: GameAction) => keysFor(action).some((code) => this.held.has(code));

    let moveX = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    let moveY = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    let run = down('run');
    let confirm = this.latchedConfirm;
    let pause = this.latchedPause;
    let action = this.latchedAction;
    this.latchedConfirm = false;
    this.latchedPause = false;
    this.latchedAction = false;

    const pad = this.pad();
    if (pad) {
      const sx = pad.axes.length > 0 ? pad.axes[0]!.getValue() : 0;
      const sy = pad.axes.length > 1 ? pad.axes[1]!.getValue() : 0;
      if (Math.hypot(sx, sy) > STICK_DEADZONE) {
        moveX = sx;
        moveY = sy;
      }
      if (pad.left) moveX = -1;
      if (pad.right) moveX = 1;
      if (pad.up) moveY = -1;
      if (pad.down) moveY = 1;
      run = run || pad.B || pad.R2 > 0.3;
      const padConfirm = pad.A;
      const padPause = pad.buttons.length > 9 ? pad.buttons[9]!.pressed : false;
      confirm = confirm || (padConfirm && !this.prevPadConfirm);
      pause = pause || (padPause && !this.prevPadPause);
      const padAction = pad.Y;
      action = action || (padAction && !this.prevPadAction);
      this.prevPadConfirm = padConfirm;
      this.prevPadPause = padPause;
      this.prevPadAction = padAction;
    }

    return { moveX, moveY, run, confirm, pause, action };
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.getPad(0) ?? null;
  }
}
