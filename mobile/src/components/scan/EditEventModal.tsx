/**
 * EditEventModal — the archived EditEvent: title, day, all-day / time range, note, delete.
 * Also used to add an event the scan missed.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { EditableEvent } from '../../scan/ScanSession';
import { addDays, formatDay, formatTime } from '../../scan/format';
import { Button } from '../ui/Button';
import { TimePickerModal } from './TimePickerModal';

interface Props {
  visible: boolean;
  event: EditableEvent | null;
  /** Days on this page, offered as quick picks */
  days: string[];
  isNew?: boolean;
  onCancel: () => void;
  onSave: (e: EditableEvent) => void;
  onDelete: (key: string) => void;
}

export function EditEventModal({ visible, event, days, isNew, onCancel, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<EditableEvent | null>(event);
  const [hasRange, setHasRange] = useState(false);
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && event) {
      setDraft(event);
      setHasRange(!!event.end);
      setConfirmDelete(false);
      setError(null);
    }
  }, [visible, event]);

  if (!draft) return null;
  const set = (patch: Partial<EditableEvent>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const dayOptions = Array.from(new Set([...days, draft.date])).sort();

  function save() {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return setError('Please enter a title.');
    if (!draft.allDay && !draft.start) return setError('Please choose a time, or turn on All day.');
    if (!draft.allDay && hasRange && (!draft.end || draft.end <= (draft.start ?? ''))) {
      return setError('End time must be after the start time.');
    }
    onSave({
      ...draft,
      title,
      start: draft.allDay ? null : draft.start,
      end: draft.allDay || !hasRange ? null : draft.end,
      note: draft.note?.trim() || null,
      confidence: 1, // user-confirmed
    });
  }

  const row = 'mb-5';
  const lbl = 'mb-2 text-base font-semibold text-navy';
  const field = 'rounded-xl border-2 border-sage bg-cream p-4 text-base text-navy';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-3xl bg-white px-5 pb-10 pt-5">
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-navy">{isNew ? 'Add Event' : 'Edit Event'}</Text>
              {!isNew && (
                <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} accessibilityLabel="Delete event">
                  <Text className="text-2xl">🗑️</Text>
                </Pressable>
              )}
            </View>

            {confirmDelete && (
              <View className="mb-5 rounded-xl bg-rose/40 p-4">
                <Text className="mb-3 text-base text-navy">Remove this event from the scan?</Text>
                <View className="flex-row gap-3">
                  <Button title="Keep" variant="ghost" onPress={() => setConfirmDelete(false)} className="flex-1" />
                  <Button title="Remove" variant="danger" onPress={() => onDelete(draft.key)} className="flex-1" />
                </View>
              </View>
            )}

            <View className={row}>
              <Text className={lbl}>Title</Text>
              <TextInput className={field} value={draft.title} onChangeText={(t) => set({ title: t })} placeholder="Event title" placeholderTextColor="#4A4B4F99" />
            </View>

            <View className={row}>
              <Text className={lbl}>Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dayOptions.map((d) => {
                  const active = d === draft.date;
                  return (
                    <Pressable key={d} onPress={() => set({ date: d })} className={`mr-2 rounded-full px-4 py-2 ${active ? 'bg-navy' : 'bg-cream'}`}>
                      <Text className={`font-semibold ${active ? 'text-white' : 'text-navy'}`}>{formatDay(d)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View className="mt-2 flex-row gap-4">
                <Pressable onPress={() => set({ date: addDays(draft.date, -1) })} hitSlop={8}><Text className="text-purple">‹ Day before</Text></Pressable>
                <Pressable onPress={() => set({ date: addDays(draft.date, 1) })} hitSlop={8}><Text className="text-purple">Day after ›</Text></Pressable>
              </View>
            </View>

            <View className={`${row} flex-row items-center justify-between`}>
              <Text className={lbl}>All day</Text>
              <Switch value={draft.allDay} onValueChange={(v) => set({ allDay: v, start: v ? null : draft.start ?? '09:00' })} trackColor={{ true: '#B995A9' }} />
            </View>

            {!draft.allDay && (
              <>
                <View className={`${row} flex-row items-center justify-between`}>
                  <Text className={lbl}>Has an end time</Text>
                  <Switch value={hasRange} onValueChange={setHasRange} trackColor={{ true: '#B995A9' }} />
                </View>
                <View className={`${row} flex-row gap-3`}>
                  <Pressable onPress={() => setPicker('start')} className={`flex-1 ${field}`}>
                    <Text className="text-xs text-warm-gray">Start</Text>
                    <Text className="text-lg font-semibold text-navy">{draft.start ? formatTime(draft.start) : 'Choose'} ⏰</Text>
                  </Pressable>
                  {hasRange && (
                    <Pressable onPress={() => setPicker('end')} className={`flex-1 ${field}`}>
                      <Text className="text-xs text-warm-gray">End</Text>
                      <Text className="text-lg font-semibold text-navy">{draft.end ? formatTime(draft.end) : 'Choose'} ⏰</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <View className={row}>
              <Text className={lbl}>Note (optional)</Text>
              <TextInput className={field} value={draft.note ?? ''} onChangeText={(t) => set({ note: t })} placeholder="Add a note" placeholderTextColor="#4A4B4F99" multiline />
            </View>

            {error && <Text className="mb-4 text-base text-red-700">{error}</Text>}

            <View className="flex-row gap-3">
              <Button title="Cancel" variant="ghost" onPress={onCancel} className="flex-1" />
              <Button title={isNew ? 'Add' : 'Save'} onPress={save} className="flex-1" />
            </View>
          </ScrollView>
        </View>
      </View>

      <TimePickerModal
        visible={picker !== null}
        title={picker === 'end' ? 'End time' : 'Start time'}
        value={picker === 'end' ? draft.end ?? draft.start : draft.start}
        onCancel={() => setPicker(null)}
        onConfirm={(t) => {
          set(picker === 'end' ? { end: t } : { start: t });
          setPicker(null);
        }}
      />
    </Modal>
  );
}
