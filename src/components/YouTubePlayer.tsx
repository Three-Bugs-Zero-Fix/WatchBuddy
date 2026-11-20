import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';
import { PlaybackState } from '../services/rooms';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => YTPlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YouTubePlayerProps {
  playback: PlaybackState;
  isHost: boolean;
  onHostSync: (isPlaying: boolean, currentTime: number) => void;
}

/**
 * Calculates the expected live playback timestamp, accounting for elapsed time.
 */
function getExpectedTime(playback: PlaybackState): number {
  if (!playback.isPlaying || !playback.updatedAt) {
    return playback.currentTime;
  }
  const elapsedSeconds = Math.max(0, (Date.now() - playback.updatedAt) / 1000);
  return playback.currentTime + elapsedSeconds;
}

export default function YouTubePlayer({
  playback,
  isHost,
  onHostSync,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const currentVideoIdRef = useRef<string>('');
  const playbackRef = useRef<PlaybackState>(playback);
  const isHostRef = useRef<boolean>(isHost);
  const onHostSyncRef = useRef(onHostSync);

  const [isReady, setIsReady] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  playbackRef.current = playback;
  isHostRef.current = isHost;
  onHostSyncRef.current = onHostSync;

  const hasVideo = Boolean(playback.videoId);

  // Load the YouTube IFrame API script once and initialize the player
  useEffect(() => {
    if (!hasVideo) return;

    const initPlayer = () => {
      if (!containerRef.current || !window.YT?.Player || playerRef.current) {
        return;
      }

      const startSeconds = Math.floor(getExpectedTime(playbackRef.current));
      currentVideoIdRef.current = playbackRef.current.videoId;

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId: playbackRef.current.videoId,
        playerVars: {
          autoplay: playbackRef.current.isPlaying ? 1 : 0,
          start: startSeconds,
          controls: isHostRef.current ? 1 : 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: { target: YTPlayerInstance }) => {
            setIsReady(true);
            const expected = getExpectedTime(playbackRef.current);
            event.target.seekTo(expected, true);

            if (playbackRef.current.isPlaying) {
              event.target.playVideo();
              // Detect if the browser blocked unmuted autoplay for guests
              setTimeout(() => {
                if (
                  !isHostRef.current &&
                  playbackRef.current.isPlaying &&
                  event.target.getPlayerState() !== 1
                ) {
                  setNeedsUserInteraction(true);
                }
              }, 800);
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: {
            data: number;
            target: YTPlayerInstance;
          }) => {
            if (!isHostRef.current || !window.YT) return;

            const { PLAYING, PAUSED } = window.YT.PlayerState;
            if (event.data === PLAYING) {
              onHostSyncRef.current(true, event.target.getCurrentTime());
            } else if (event.data === PAUSED) {
              onHostSyncRef.current(false, event.target.getCurrentTime());
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(script);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        setIsReady(false);
      }
    };
  }, [hasVideo]);

  // Sync video changes, play/pause, and timestamp drift for guests (and new videos for host)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady || !playback.videoId) return;

    const expectedTime = getExpectedTime(playback);

    // Load a new video if the host pasted a different YouTube link
    if (currentVideoIdRef.current !== playback.videoId) {
      currentVideoIdRef.current = playback.videoId;
      player.loadVideoById({
        videoId: playback.videoId,
        startSeconds: expectedTime,
      });
      if (!playback.isPlaying) {
        player.pauseVideo();
      }
      return;
    }

    // Only force-sync guests to avoid fighting the host's own controls
    if (!isHost) {
      const localTime = player.getCurrentTime();
      if (Math.abs(localTime - expectedTime) > 1.5) {
        player.seekTo(expectedTime, true);
      }

      if (playback.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }, [playback, isHost, isReady]);

  // Allow guests to manually unlock browser autoplay and jump to live sync
  const handleManualSync = () => {
    const player = playerRef.current;
    if (!player) return;

    const expectedTime = getExpectedTime(playbackRef.current);
    player.seekTo(expectedTime, true);
    if (playbackRef.current.isPlaying) {
      player.playVideo();
    }
    setNeedsUserInteraction(false);
  };

  if (!hasVideo) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>You&apos;re not watching anything!</Text>
        <Text style={styles.emptySubtitle}>
          {isHost
            ? 'Paste a YouTube link above to start watching together.'
            : 'Waiting for the host to play a video...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.playerWrapper}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', borderRadius: 12 }}
      />

      {!isHost && needsUserInteraction && (
        <View style={styles.syncOverlay}>
          <Pressable style={styles.syncButton} onPress={handleManualSync}>
            <Text style={styles.syncButtonText}>
              Click to Sync &amp; Watch Live
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  syncOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    opacity: 0.92,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 10,
  },
  syncButtonText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
});