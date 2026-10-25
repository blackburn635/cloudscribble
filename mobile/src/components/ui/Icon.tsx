/**
 * Icon — Apple SF Symbols via expo-symbols (names are type-checked against Apple's list).
 * `fallback` renders on platforms without SF Symbols (Android — revisit when Android ships).
 */
import { Text } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

export const BRAND_ICON_COLOR = '#283593'; // navy
export const ACCENT_ICON_COLOR = '#6774c8'; // light purple

interface IconProps {
  name: SymbolViewProps['name'];
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
  /** Short text shown where SF Symbols aren't available. */
  fallback?: string;
}

export function Icon({ name, size = 22, color = BRAND_ICON_COLOR, weight = 'semibold', fallback = '•' }: IconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      style={{ width: size, height: size }}
      fallback={<Text style={{ fontSize: size * 0.8, color }}>{fallback}</Text>}
    />
  );
}
