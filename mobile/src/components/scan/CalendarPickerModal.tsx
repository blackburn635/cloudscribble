import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { WritableCalendar } from '../../scan/calendar';
import { Button } from '../ui/Button';

interface Props {
  visible: boolean;
  calendars: WritableCalendar[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onContinue: () => void;
}

export function CalendarPickerModal({ visible, calendars, selectedId, onSelect, onCancel, onContinue }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[80%] rounded-t-3xl bg-white px-5 pb-10 pt-5">
          <Text className="mb-1 text-2xl font-bold text-navy">Choose a Calendar</Text>
          <Text className="mb-4 text-base text-warm-gray">Events will be added to this calendar.</Text>
          <ScrollView className="mb-5">
            {calendars.map((c) => {
              const active = c.id === selectedId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c.id)}
                  className={`mb-2 flex-row items-center rounded-xl border-2 p-4 ${active ? 'border-purple bg-lavender' : 'border-cream bg-cream'}`}
                >
                  <View className="mr-3 h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-navy">{c.title}</Text>
                    {!!c.source && <Text className="text-xs text-warm-gray">{c.source}</Text>}
                  </View>
                  {active && <Text className="text-lg text-purple">✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="flex-row gap-3">
            <Button title="Cancel" variant="ghost" onPress={onCancel} className="flex-1" />
            <Button title="Continue" onPress={onContinue} disabled={!selectedId} className="flex-1" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
