import { describe, expect, it } from 'vitest';
import { StaticCuller } from './culler';

describe('static culler', () => {
  it('renders only objects near the camera and leaves their own visibility alone', () => {
    const camera = { id: 1, worldView: { x: 0, y: 0, right: 640, bottom: 400 } };
    const culler = new StaticCuller(camera as never, 10_000);
    const near = { x: 100, y: 100, cameraFilter: 0, visible: true };
    const far = { x: 5000, y: 3000, cameraFilter: 0, visible: false };
    culler.add(near as never);
    culler.add(far as never);
    culler.update();
    expect(culler.isCulled(near as never)).toBe(false);
    expect(culler.isCulled(far as never)).toBe(true);
    expect(far.visible).toBe(false);
    Object.assign(camera.worldView, { x: 4800, y: 2800, right: 5440, bottom: 3200 });
    culler.update();
    expect(culler.isCulled(near as never)).toBe(true);
    expect(culler.isCulled(far as never)).toBe(false);
    expect(culler.visibleCount).toBe(1);
  });
});
