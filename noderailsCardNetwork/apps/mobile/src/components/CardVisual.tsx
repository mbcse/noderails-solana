import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Line,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { formatMaskedPanPlaceholder, formatPanDigitsForDisplay } from '../utils/panFormat';

interface CardVisualProps {
  maskedNumber?: string;
  panLastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
  cardholderName?: string;
  status?: string;
  onFlip?: () => void;
  isFlipped?: boolean;
  expandPan?: boolean;
  cvvDigits?: string;
  revealSensitive?: boolean;
}

/** Premium fintech spec: width : height = 1.62 : 1 */
const CARD_ASPECT = 1.62;
const CARD_RADIUS = 24;

const W = Math.min(Dimensions.get('window').width - 48, 380);
const H = W / CARD_ASPECT;

function CardContourTexture({ width, height }: { width: number; height: number }) {
  const cx = width * 0.9;
  const cy = height * 0.94;
  const lines = 26;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G>
        {Array.from({ length: lines }, (_, i) => {
          const t = i / (lines - 1);
          const rx = 16 + t * (width * 0.95);
          const ry = 12 + t * (height * 0.85);
          return (
            <React.Fragment key={`c-${i}`}>
              <Ellipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
                fill="none"
              />
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}

function CardFoilStripes({ width, height }: { width: number; height: number }) {
  const stripes = 36;
  const cx = width / 2;
  const cy = height / 2;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G transform={`rotate(-28 ${cx} ${cy})`}>
        {Array.from({ length: stripes }, (_, i) => {
          const x = -height + i * 14;
          return (
            <React.Fragment key={`f-${i}`}>
              <Line
                x1={x}
                y1={0}
                x2={x + height * 1.2}
                y2={height}
                stroke="rgba(255,255,255,0.035)"
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}

/** Geometric W monogram ~34px, violet → magenta → orange */
function WallCardMonogram({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <Defs>
        <SvgLinearGradient id="wcMonoGrad" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7C3AED" />
          <Stop offset="0.45" stopColor="#FF2E93" />
          <Stop offset="1" stopColor="#FF6B35" />
        </SvgLinearGradient>
      </Defs>
      <Path
        fill="url(#wcMonoGrad)"
        d="M4 6 L9.5 28 L17 11 L24.5 28 L30 6 H25 L20 23 L17 15 L14 23 L9 6 Z"
      />
    </Svg>
  );
}

/** Glossy orb ~28px, white → pink → magenta → orange */
function HoloOrb({ size = 28 }: { size?: number }) {
  const r = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: 'hidden',
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 12,
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={['#FFFFFF', '#FFB8E0', '#FF2E93', '#FF6B35']}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />
      </LinearGradient>
    </View>
  );
}

export function CardVisual({
  maskedNumber,
  panLastFour = '0000',
  expiryMonth = 12,
  expiryYear = 28,
  cardholderName = 'CARDHOLDER NAME',
  onFlip,
  isFlipped = false,
  expandPan = false,
  cvvDigits,
  revealSensitive = false,
}: CardVisualProps) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(24);
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(80, withSpring(1, { damping: 22 }));
    ty.value = withDelay(80, withSpring(0, { damping: 22 }));
  }, [opacity, ty]);

  useEffect(() => {
    flipProgress.value = withSpring(isFlipped ? 1 : 0, { damping: 16, mass: 1, overshootClamping: false });
  }, [flipProgress, isFlipped]);

  const entryAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  const frontAnim = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 1], [1, 0.45, 0], Extrapolate.CLAMP),
    transform: [
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180], Extrapolate.CLAMP)}deg` },
    ],
  }));

  const backAnim = useAnimatedStyle(() => ({
    opacity: interpolate(flipProgress.value, [0, 0.5, 1], [0, 0.55, 1], Extrapolate.CLAMP),
    transform: [
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [-180, 0], Extrapolate.CLAMP)}deg` },
    ],
  }));

  const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

  const panLine = useMemo(() => {
    if (expandPan && maskedNumber) {
      const d = maskedNumber.replace(/\s/g, '');
      if (/^\d{12,19}$/.test(d)) return formatPanDigitsForDisplay(d);
    }
    if (maskedNumber?.trim()) return maskedNumber.trim();
    return formatMaskedPanPlaceholder(panLastFour);
  }, [expandPan, maskedNumber, panLastFour]);

  const exp = `${String(expiryMonth).padStart(2, '0')}/${String(expiryYear).slice(-2)}`;
  const emboss = cardholderName.trim().toUpperCase() || 'CARDHOLDER NAME';

  const panFontSize = Math.min(26, Math.max(15, Math.floor((W - 48) / 14)));

  const renderFace = (back: boolean) => (
    <LinearGradient
      colors={['#0D0221', '#2a0f52', '#4C1D95', '#b3278a', '#FF2E93', '#FF6B35']}
      locations={[0, 0.18, 0.38, 0.58, 0.78, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cardBase, { width: W, height: H, borderRadius: CARD_RADIUS }]}
    >
      {!back ? <CardContourTexture width={W} height={H} /> : null}
      {!back ? <CardFoilStripes width={W} height={H} /> : null}

      {/* Soft radial bloom bottom-right (smooth blend, no banding) */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(255,46,147,0.12)', 'rgba(255,107,53,0.22)']}
        locations={[0, 0.45, 0.72, 1]}
        start={{ x: 0.15, y: 0.15 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
        pointerEvents="none"
      />

      {/* Glass bezel: top inner highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)', 'transparent']}
        style={[styles.topBezel, { borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }]}
        pointerEvents="none"
      />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          },
        ]}
      />

      {back ? (
        <View style={styles.cardContentBack}>
          <Text style={styles.backHint}>Virtual card</Text>
          <View style={styles.magneticStripeMinimal} />
          <View style={styles.cvvArea}>
            <Text style={styles.cvvLabel}>CVV</Text>
            <View style={styles.cvvBox}>
              <Text style={[styles.cvvValue, { fontFamily: mono }]}>
                {revealSensitive && cvvDigits ? cvvDigits : '•••'}
              </Text>
            </View>
          </View>
          <Text style={styles.legalCopy}>Wallet keys stay with NodeRails secure signer.</Text>
        </View>
      ) : (
        <View style={styles.cardContent}>
          {/* Top lockup */}
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <View style={styles.monogramRow}>
                <WallCardMonogram size={34} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.wordmark}>WALLCARD</Text>
                  <Text style={styles.tagline}>WALLET · DEBIT</Text>
                </View>
              </View>
            </View>
            <View style={styles.topRight}>
              <Text style={styles.poweredLabel}>POWERED BY</Text>
              <Text style={styles.blockchainWord}>BLOCKCHAIN</Text>
              <View style={{ marginTop: 6, alignSelf: 'flex-end' }}>
                <HoloOrb size={28} />
              </View>
            </View>
          </View>

          {/* Glass pill — mid-left */}
          <View style={styles.midRow}>
            {Platform.OS === 'web' ? (
              <View style={[styles.glassPill, styles.glassPillFallback]}>
                <Text style={styles.pillWallet}>WALLET</Text>
                <Text style={styles.pillOnChain}> ON-CHAIN</Text>
              </View>
            ) : (
              <BlurView intensity={55} tint="dark" style={styles.glassPill}>
                <Text style={styles.pillWallet}>WALLET</Text>
                <Text style={styles.pillOnChain}> ON-CHAIN</Text>
              </BlurView>
            )}
          </View>

          {/* PAN */}
          <View style={styles.panBlock}>
            <Text
              style={[
                styles.panText,
                {
                  fontSize: panFontSize,
                  fontFamily: mono,
                  fontWeight: '500',
                },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {panLine}
            </Text>
          </View>

          {/* Bottom row */}
          <View style={styles.bottomRow}>
            <View style={styles.bottomCol}>
              <Text style={styles.metaLabel}>CARDHOLDER</Text>
              <Text style={styles.cardholderValue} numberOfLines={1}>
                {emboss}
              </Text>
            </View>
            <View style={[styles.bottomCol, styles.bottomColCenter]}>
              <Text style={styles.metaLabel}>EXP</Text>
              <Text style={[styles.expValue, { fontFamily: mono }]}>{exp}</Text>
            </View>
            <View style={[styles.bottomCol, styles.bottomColRight]}>
              <Text style={styles.nodeRails}>NodeRails</Text>
              <Text style={styles.networkLabel}>NETWORK</Text>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );

  return (
    <Animated.View style={[styles.root, entryAnim]}>
      <Animated.View style={[styles.cardShell, { width: W, height: H }]}>
        <Pressable onPress={onFlip} style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, frontAnim, styles.flipFace]}>
            {renderFace(false)}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFillObject, backAnim, styles.flipFace]}>
            {renderFace(true)}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
  },
  cardShell: {
    borderRadius: CARD_RADIUS,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  flipFace: {
    backfaceVisibility: 'hidden',
  },
  cardBase: {
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
  },
  topBezel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topLeft: {
    flex: 1,
    paddingRight: 8,
  },
  monogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 13 * 0.04,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tagline: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 9 * 0.32,
  },
  topRight: {
    alignItems: 'flex-end',
    maxWidth: 120,
  },
  poweredLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 7.5,
    fontWeight: '600',
    letterSpacing: 7.5 * 0.28,
    textTransform: 'uppercase',
  },
  blockchainWord: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 10 * 0.22,
    textTransform: 'uppercase',
  },
  midRow: {
    marginTop: 10,
    alignItems: 'flex-start',
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glassPillFallback: {
    backgroundColor: 'rgba(30, 20, 45, 0.65)',
  },
  pillWallet: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  pillOnChain: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.28,
  },
  panBlock: {
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  panText: {
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(255,255,255,0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  bottomCol: {
    flex: 1,
    minWidth: 0,
  },
  bottomColCenter: {
    alignItems: 'center',
    flex: 0.85,
  },
  bottomColRight: {
    alignItems: 'flex-end',
    flex: 1.1,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  cardholderValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  expValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  nodeRails: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  networkLabel: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 8.5 * 0.28,
  },

  cardContentBack: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
    zIndex: 2,
  },
  backHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 12,
  },
  magneticStripeMinimal: {
    width: '100%',
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    marginBottom: 20,
  },
  cvvArea: {
    alignItems: 'center',
    gap: 8,
  },
  cvvLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cvvBox: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  cvvValue: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  legalCopy: {
    paddingTop: 12,
    paddingBottom: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 13,
  },
});
