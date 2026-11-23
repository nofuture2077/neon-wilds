import Phaser from 'phaser';

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
 * Keyboard: WASD / arrows move, Shift runs (handbrake in cars), E / Space / Enter interacts, F enters/exits vehicles, Esc pauses.
 * Gamepad (standard mapping): left stick / d-pad move, A interacts, B or RT runs, Y enters/exits vehicles, Start pauses.
 */
export class InputMapper {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private prevPadConfirm = false;
  private prevPadPause = false;
  // Edge-triggered actions are latched from keydown events: Phaser's JustDown
  // loses presses that start and end within a single frame (fast taps).
  private latchedConfirm = false;
  private latchedPause = false;
  private latchedAction = false;
  private prevPadAction = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.W,
      down: K.S,
      left: K.A,
      right: K.D,
      up2: K.UP,
      down2: K.DOWN,
      left2: K.LEFT,
      right2: K.RIGHT,
      run: K.SHIFT,
      interact: K.E,
      space: K.SPACE,
      enter: K.ENTER,
      esc: K.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === 'KeyE' || ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'NumpadEnter') this.latchedConfirm = true;
      if (ev.code === 'Escape') this.latchedPause = true;
      if (ev.code === 'KeyF') this.latchedAction = true;
    };
    kb.on('keydown', onKeyDown);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKeyDown));
  }

  read(): FrameInput {
    const k = this.keys;
    const down = (name: string) => k[name]?.isDown ?? false;

    let moveX = (down('right') || down('right2') ? 1 : 0) - (down('left') || down('left2') ? 1 : 0);
    let moveY = (down('down') || down('down2') ? 1 : 0) - (down('up') || down('up2') ? 1 : 0);
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
