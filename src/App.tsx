import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { Colors, Fonts } from './theme';
import { createRoom, joinRoom } from './services/rooms';
import RoomScreen from './screens/RoomScreen';
import introVideo from './assets/intro.mp4';

interface FeatureItem {
  title: string;
  description: string;
  symbol: string;
}

const FEATURES: FeatureItem[] = [
  {
    title: 'Synchronized Watching',
    description: 'Watch every moment together. Playback stays in sync for everyone.',
    symbol: '01',
  },
  {
    title: 'Live Room Chat',
    description: 'Share reactions, talk and enjoy the experience together.',
    symbol: '02',
  },
  {
    title: 'Private Rooms',
    description: 'Create a room and invite your friends with a simple link.',
    symbol: '03',
  },
];

const PREVIEW_AVATARS = ['A', 'J', 'S', '+'];

/**
 * Renders the animated brand name in the navigation bar.
 */
function AnimatedBrandText() {
  return (
    <div className="brand-text-container">
      <span
        className="brand-text"
        style={{
          color: Colors.text,
          fontFamily: Fonts.bold,
          fontSize: 22,
          fontWeight: '700',
        }}
      >
        WatchBuddy
      </span>
    </div>
  );
}

/**
 * Landing screen where users enter their display name to create or join a room.
 */
function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 850;
  const navigate = useNavigate();

  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [notice, setNotice] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const isBusy = isCreating || isJoining;
  const currentYear = new Date().getFullYear();

  // Create a new room in Firebase RTDB and navigate to the room screen
  const handleCreateRoom = async () => {
    if (!guestName.trim()) {
      setNotice('Please enter your name first.');
      return;
    }

    try {
      setIsCreating(true);
      setNotice('');
      const { roomCode: newCode } = await createRoom(guestName);
      navigate(`/room/${newCode}`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Failed to create room.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Validate room code, register participant in Firebase RTDB, and join room
  const handleJoinRoom = async () => {
    if (!guestName.trim()) {
      setNotice('Please enter your name first.');
      return;
    }

    if (!roomCode.trim()) {
      setNotice('Please enter a room code.');
      return;
    }

    try {
      setIsJoining(true);
      setNotice('');
      const { roomCode: validCode } = await joinRoom(roomCode, guestName);
      navigate(`/room/${validCode}`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Failed to join room.',
      );
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Navigation bar */}
      <View style={styles.navbar}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>W</Text>
          </View>

          <AnimatedBrandText />
        </View>

        {isWide && (
          <Text style={styles.navTagline}>
            Your friends. Your videos. Together.
          </Text>
        )}
      </View>

      {/* Hero section */}
      <View
        style={[
          styles.hero,
          isWide ? styles.heroWide : styles.heroNarrow,
        ]}
      >
        <View style={styles.heroContent}>
          <View style={styles.eyebrow}>
            <View style={styles.onlineDot} />
            <Text style={styles.eyebrowText}>
              WATCH TOGETHER, ANYWHERE
            </Text>
          </View>

          <Text style={styles.heading}>
            Good videos are{'\n'}
            <Text style={styles.headingHighlight}>
              better together.
            </Text>
          </Text>

          <Text style={styles.heroDescription}>
            Bring your friends together, play your favorite YouTube
            videos and enjoy every moment in perfect sync.
          </Text>

          {/* Display name input */}
          <View style={styles.nameInputContainer}>
            <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>

            <TextInput
              value={guestName}
              onChangeText={value => {
                setGuestName(value);
                if (notice) {
                  setNotice('');
                }
              }}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
              maxLength={24}
              editable={!isBusy}
            />
          </View>

          {/* Create and join room actions */}
          <View
            style={[
              styles.actions,
              !isWide && styles.actionsNarrow,
            ]}
          >
            <Pressable
              onPress={handleCreateRoom}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.createButton,
                pressed && styles.buttonPressed,
                isBusy && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? 'Creating...' : '+ Create a Room'}
              </Text>
            </Pressable>

            <View style={styles.joinContainer}>
              <TextInput
                value={roomCode}
                onChangeText={value => {
                  setRoomCode(value.toUpperCase());
                  if (notice) {
                    setNotice('');
                  }
                }}
                placeholder="Enter room code"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
                style={styles.roomInput}
                maxLength={12}
                editable={!isBusy}
              />

              <Pressable
                onPress={handleJoinRoom}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.joinButton,
                  pressed && styles.buttonPressed,
                  isBusy && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.joinButtonText}>
                  {isJoining ? 'Joining...' : 'Join'}
                </Text>
              </Pressable>
            </View>
          </View>

          {notice ? (
            <Text style={styles.notice}>{notice}</Text>
          ) : null}
        </View>

        {/* Hero preview card */}
        <View style={styles.visualContainer}>
          <View style={styles.visualGlow} />

          <View style={styles.visualCard}>
            <View style={styles.visualTop}>
              <View style={styles.liveIndicator}>
                <View style={styles.onlineDot} />
                <Text style={styles.liveText}>LIVE ROOM</Text>
              </View>

              <Text style={styles.roomId}>WB · {currentYear}</Text>
            </View>

            <View style={styles.videoPlaceholder}>
              <video
                src={introVideo}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 13,
                }}
              />
            </View>

            <View style={styles.visualBottom}>
              <View style={styles.avatarGroup}>
                {PREVIEW_AVATARS.map((item, index) => (
                  <View
                    key={item}
                    style={[
                      styles.avatar,
                      { zIndex: PREVIEW_AVATARS.length - index },
                      index === 0 && styles.avatarOne,
                      index === 1 && styles.avatarTwo,
                      index === 2 && styles.avatarThree,
                      index === 3 && styles.avatarFour,
                    ]}
                  >
                    <Text style={styles.avatarText}>{item}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.watchingText}>
                Friends watching together
              </Text>
            </View>
          </View>

          <View style={styles.floatingLabel}>
            <Text style={styles.floatingLabelText}>
              Perfectly in sync
            </Text>
          </View>
        </View>
      </View>

      {/* Features section */}
      <View style={styles.featuresSection}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            Everything is better together.
          </Text>

          <Text style={styles.sectionDescription}>
            Everything you need for a shared watching experience.
          </Text>
        </View>

        <View
          style={[
            styles.featuresGrid,
            !isWide && styles.featuresGridNarrow,
          ]}
        >
          {FEATURES.map(feature => (
            <View key={feature.symbol} style={styles.featureCard}>
              <Text style={styles.featureNumber}>
                {feature.symbol}
              </Text>

              <Text style={styles.featureTitle}>
                {feature.title}
              </Text>

              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Made for moments worth sharing.
        </Text>

        <Text style={styles.footerBrand}>WatchBuddy</Text>
      </View>
    </ScrollView>
  );
}

/**
 * Root application router.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/room/:roomCode" element={<RoomScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pageContent: {
    flexGrow: 1,
    paddingHorizontal: '6%',
  },

  navbar: {
    minHeight: 82,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: Fonts.bold,
    fontWeight: '700',
  },
  navTagline: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },

  hero: {
    paddingVertical: 75,
    alignItems: 'center',
    gap: 50,
  },
  heroWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroNarrow: {
    flexDirection: 'column',
    paddingVertical: 55,
  },
  heroContent: {
    flex: 1,
    maxWidth: 590,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 23,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  eyebrowText: {
    color: Colors.accent,
    fontFamily: Fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  heading: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 54,
    fontWeight: '700',
    lineHeight: 66,
  },
  headingHighlight: {
    color: Colors.accent,
  },
  heroDescription: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 27,
    marginTop: 20,
    maxWidth: 480,
  },

  nameInputContainer: {
    marginTop: 28,
    maxWidth: 380,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 9,
  },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  actionsNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 23,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  joinContainer: {
    flexDirection: 'row',
    flex: 1,
    minWidth: 210,
    gap: 7,
  },
  roomInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 13,
    paddingHorizontal: 13,
  },
  joinButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  notice: {
    color: Colors.accent,
    fontFamily: Fonts.regular,
    fontSize: 13,
    marginTop: 12,
  },

  visualContainer: {
    flex: 1,
    maxWidth: 440,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  visualGlow: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 250,
    backgroundColor: Colors.primary,
    opacity: 0.13,
  },
  visualCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  visualTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveText: {
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
  },
  roomId: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 11,
  },
  videoPlaceholder: {
    height: 220,
    borderRadius: 13,
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 17,
    gap: 12,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  avatarOne: {
    backgroundColor: Colors.primary,
  },
  avatarTwo: {
    backgroundColor: Colors.secondary,
  },
  avatarThree: {
    backgroundColor: Colors.accent,
  },
  avatarFour: {
    backgroundColor: Colors.surfaceSecondary,
  },
  avatarText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 10,
    fontWeight: '700',
  },
  watchingText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 11,
  },
  floatingLabel: {
    position: 'absolute',
    right: -12,
    top: 35,
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  floatingLabelText: {
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 11,
    fontWeight: '500',
  },

  featuresSection: {
    paddingVertical: 45,
  },
  sectionHeading: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 26,
    fontWeight: '700',
  },
  sectionDescription: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 14,
    marginTop: 9,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featuresGridNarrow: {
    flexDirection: 'column',
  },
  featureCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: Colors.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 23,
  },
  featureNumber: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 20,
  },
  featureTitle: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  featureDescription: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 21,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    minHeight: 75,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  footerBrand: {
    color: Colors.accent,
    fontFamily: Fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default App;