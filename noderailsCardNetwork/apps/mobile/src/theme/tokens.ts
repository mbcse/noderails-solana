export const tokens = {
  colors: {
    // Surfaces - Light theme
    background:      '#FAF8F4',
    /** Alias used by legacy screens / navigator */
    bg:              '#FAF8F4',
    foreground:      '#1C1726',
    card:            '#FFFFFF',
    secondary:       '#F4EFF3',
    muted:           '#F5F0F4',
    'muted-foreground': '#756B82',
    border:          '#E8E2EA',
    
    // Aurora palette (hero accents only)
    'aurora-deep':   '#0D0221',
    'aurora-violet': '#7C3AED',
    'aurora-magenta': '#FF2E93',
    'aurora-orange': '#FF6B35',
    accent:          '#FF2E93', // rose/magenta
    
    // Semantic colors
    success:         '#4ade80',
    'success-bg':    'rgba(74,222,128,0.15)',
    warning:         '#fbbf24',
    'warning-bg':    'rgba(251,191,36,0.15)',
    danger:          '#f87171',
    'danger-bg':     'rgba(248,113,113,0.15)',
    
    // Gradients (use these in LinearGradient)
    'gradient-aurora': ['#0D0221', '#4C1D95', '#FF2E93', '#FF6B35'],
    'gradient-text':   ['#7C3AED', '#FF2E93', '#FF6B35'],
    'gradient-soft':   ['#F7F1F6', '#FBF1E8'],
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  radius: {
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    full: 999,
  },
  
  fontSize: {
    xs:   10,
    sm:   12,
    md:   14,
    lg:   18,
    xl:   22,
    xxl:  28,
    hero: 36,
  },
  
  fontWeight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },
  
  // Shadows - aurora-inspired with rose tint
  shadows: {
    card: {
      shadowColor: '#FF2E93',
      shadowOffset: { width: 0, height: 30 },
      shadowOpacity: 0.35,
      shadowRadius: 60,
      elevation: 12,
    },
    soft: {
      shadowColor: '#786B8C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 4,
    },
    glow: {
      shadowColor: '#FF6BB8',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 40,
      elevation: 8,
    },
  },
} as const;

export type Tokens = typeof tokens;
