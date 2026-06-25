import {Composition} from 'remotion';
import {PratoByReel, pratoByReelMetadata} from './PratoByReel';

export const Root = () => {
  return (
    <Composition
      id="PratoByReel"
      component={PratoByReel}
      durationInFrames={pratoByReelMetadata.durationInFrames}
      fps={pratoByReelMetadata.fps}
      width={pratoByReelMetadata.width}
      height={pratoByReelMetadata.height}
    />
  );
};
