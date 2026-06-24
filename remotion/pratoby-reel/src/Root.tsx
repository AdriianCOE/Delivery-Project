import {Composition} from 'remotion';
import {PratoByReel} from './PratoByReel';

const REEL = {
  id: 'PratoByReel',
  durationInSeconds: 15,
  fps: 30,
  width: 1080,
  height: 1920,
} as const;

export const Root = () => {
  return (
    <Composition
      id={REEL.id}
      component={PratoByReel}
      durationInFrames={REEL.durationInSeconds * REEL.fps}
      fps={REEL.fps}
      width={REEL.width}
      height={REEL.height}
    />
  );
};