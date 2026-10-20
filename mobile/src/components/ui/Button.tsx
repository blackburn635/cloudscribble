/**
 * Button — the archived app's CloudScribbleButton in NativeWind.
 *   primary   light purple fill, white label (main actions)
 *   secondary mauve fill, white label
 *   ghost     no fill, purple label (low-emphasis)
 *   danger    red fill (destructive)
 */
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const FILL: Record<ButtonVariant, string> = {
  primary: 'bg-purple',
  secondary: 'bg-mauve',
  ghost: 'bg-transparent',
  danger: 'bg-red-700',
};
const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  ghost: 'text-purple',
  danger: 'text-white',
};

export function Button({ title, variant = 'primary', loading = false, disabled = false, className = '', ...rest }: ButtonProps) {
  const inactive = disabled || loading;
  const shadow = variant === 'ghost' ? '' : 'shadow-sm';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      className={`min-h-[52px] items-center justify-center rounded-xl px-7 py-3.5 active:opacity-80 ${FILL[variant]} ${shadow} ${className}`}
      style={{ opacity: inactive ? 0.6 : 1 }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#6774c8' : '#ffffff'} />
      ) : (
        <Text className={`text-center text-base font-semibold ${LABEL[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}
