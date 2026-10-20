/**
 * Input — labelled field in the archived app's style (cream fill, sage border, navy text),
 * with optional helper and inline error text. Forwards its ref for focus chaining.
 */
import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  helper?: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, helper, error, ...rest }, ref) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-base font-semibold text-navy">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor="#4A4B4F99"
        className={`rounded-xl border-2 bg-cream p-4 text-base text-navy ${error ? 'border-red-600' : 'border-sage'}`}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 text-sm text-red-700">{error}</Text>
      ) : helper ? (
        <Text className="mt-1 text-sm text-warm-gray">{helper}</Text>
      ) : null}
    </View>
  );
});
