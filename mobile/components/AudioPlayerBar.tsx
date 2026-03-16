import { type AudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useRef } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

interface AudioPlayerBarProps {
  player: AudioPlayer | null;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function AudioPlayerBar({ player }: AudioPlayerBarProps) {
  const trackWidth = useRef(0);

  // useAudioPlayerStatus requires a non-null player — guard with a dummy render
  if (!player) {
    return <AudioPlayerBarDisabled />;
  }

  return <AudioPlayerBarInner player={player} trackWidthRef={trackWidth} />;
}

function AudioPlayerBarDisabled() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surfaceHover, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textTertiary, fontSize: 16 }}>▶</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontVariant: ['tabular-nums'] }}>0:00 / 0:00</Text>
      </View>
    </View>
  );
}

function AudioPlayerBarInner({
  player,
  trackWidthRef,
}: {
  player: AudioPlayer;
  trackWidthRef: React.RefObject<number>;
}) {
  const { colors } = useTheme();
  const status = useAudioPlayerStatus(player);

  const currentTime = status.currentTime;
  const duration = status.duration;
  const isPlaying = status.playing;
  const isLoaded = status.isLoaded;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  // Reset to start when audio finishes
  if (status.didJustFinish) {
    player.seekTo(0);
  }

  const togglePlayPause = useCallback(() => {
    if (!isLoaded) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, isPlaying, isLoaded]);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    (trackWidthRef as React.MutableRefObject<number>).current = e.nativeEvent.layout.width;
  }, [trackWidthRef]);

  const handleSeek = useCallback(
    (e: GestureResponderEvent) => {
      if (!isLoaded || duration <= 0) return;
      const width = trackWidthRef.current;
      if (width <= 0) return;
      const x = e.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(x / width, 1));
      player.seekTo(ratio * duration);
    },
    [player, isLoaded, duration, trackWidthRef],
  );

  return (
    <View style={{ backgroundColor: colors.surfaceHover, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TouchableOpacity
        onPress={togglePlayPause}
        style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
        disabled={!isLoaded}
      >
        <Text style={{ color: isLoaded ? colors.text : colors.textTertiary, fontSize: 16 }}>
          {isPlaying ? '❚❚' : '▶'}
        </Text>
      </TouchableOpacity>

      <View style={{ flex: 1, gap: 4 }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleSeek}
          onLayout={handleTrackLayout}
          style={{ height: 16, justifyContent: 'center' }}
        >
          <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: colors.accent, borderRadius: 2 }} />
          </View>
        </TouchableOpacity>

        <Text style={{ color: colors.textSecondary, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}
