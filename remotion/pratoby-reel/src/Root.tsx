import {Composition} from 'remotion';
import {PratoByReel} from './PratoByReel';

export const Root = () => {
  return (
    <Composition
      id="PratoByReel"
      component={PratoByReel}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
