/**
 * TimePickerModal — hour / minute / AM-PM columns (the archived TimePicker, in NativeWind).
 * Value in and out is 24h "HH:MM".
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../ui/Button';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function split(hhmm: string | null) {
  const [h, m] = (hhmm ?? '09:00').split(':').map(Number);
  return { hour12: ((h + 11) % 12) + 1, minute: m - (m % 5), pm: h >= 12 };
}

interface Props {
  visible: boolean;
  title: string;
  value: string | null;
  onCancel: () => void;
  onConfirm: (hhmm: string) => void;
}

export function TimePickerModal({ visible, title, value, onCancel, onConfirm }: Props) {
  const [sel, setSel] = useState(split(value));
  useEffect(() => {
    if (visible) setSel(split(value));
  }, [visible, value]);

  const confirm = () => {
    const h24 = (sel.hour12 % 12) + (sel.pm ? 12 : 0);
    onConfirm(`${String(h24).padStart(2, '0')}:${String(sel.minute).padStart(2, '0')}`);
  };

  const cell = (active: boolean) => `mb-2 rounded-xl px-4 py-3 ${active ? 'bg-purple' : 'bg-cream'}`;
  const label = (active: boolean) => `text-center text-lg font-semibold ${active ? 'text-white' : 'text-navy'}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full rounded-2xl bg-white p-5">
          <Text className="mb-4 text-center text-xl font-bold text-navy">{title}</Text>
          <View className="h-64 flex-row gap-3">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {HOURS.map((h) => (
                <Pressable key={h} className={cell(sel.hour12 === h)} onPress={() => setSel((s) => ({ ...s, hour12: h }))}>
                  <Text className={label(sel.hour12 === h)}>{h}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {MINUTES.map((m) => (
                <Pressable key={m} className={cell(sel.minute === m)} onPress={() => setSel((s) => ({ ...s, minute: m }))}>
                  <Text className={label(sel.minute === m)}>{String(m).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View className="flex-1">
              {(['AM', 'PM'] as const).map((p) => {
                const active = sel.pm === (p === 'PM');
                return (
                  <Pressable key={p} className={cell(active)} onPress={() => setSel((s) => ({ ...s, pm: p === 'PM' }))}>
                    <Text className={label(active)}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="mt-5 flex-row gap-3">
            <Button title="Cancel" variant="ghost" onPress={onCancel} className="flex-1" />
            <Button title="Set Time" onPress={confirm} className="flex-1" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
