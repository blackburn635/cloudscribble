/**
 * Review — photo + events grouped by day; tap to edit, add a missed event, retake, or save.
 * Save: pick calendar → see exactly what will change → apply. Nothing is written before confirm.
 */
import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { newEventKey, useScanSession, type EditableEvent } from '../../scan/ScanSession';
import { addDays, formatDay, formatWhen } from '../../scan/format';
import {
  applySync,
  ensureCalendarPermission,
  getLastCalendarId,
  listWritableCalendars,
  prepareSync,
  type PreparedSync,
  type SyncResult,
  type WritableCalendar,
} from '../../scan/calendar';
import { Button } from '../../components/ui/Button';
import { EditEventModal } from '../../components/scan/EditEventModal';
import { CalendarPickerModal } from '../../components/scan/CalendarPickerModal';
import { SyncConfirmModal } from '../../components/scan/SyncConfirmModal';

export function ReviewScreen({ navigation }: NativeStackScreenProps<AppStackParamList, 'Review'>) {
  const { photoUri, result, events, upsertEvent, removeEvent, reset } = useScanSession();
  const [editing, setEditing] = useState<{ event: EditableEvent; isNew: boolean } | null>(null);
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [stage, setStage] = useState<'review' | 'pick' | 'confirm'>('review');
  const [prep, setPrep] = useState<PreparedSync | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const days = useMemo(() => {
    const set = new Set(events.map((e) => e.date));
    const pd = result?.pageDates;
    // Every day the page covers (capped, in case a monthly grid was misread).
    if (pd) for (let d = pd.start, i = 0; d <= pd.end && i < 42; d = addDays(d, 1), i++) set.add(d);
    return Array.from(set).sort();
  }, [events, result]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, EditableEvent[]>();
    for (const e of [...events].sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))) {
      byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
    }
    return Array.from(byDay.entries());
  }, [events]);

  async function startSave() {
    setError(null);
    if (!(await ensureCalendarPermission())) return setPermissionDenied(true);
    const cals = await listWritableCalendars();
    setCalendars(cals);
    const last = await getLastCalendarId();
    setCalendarId(cals.some((c) => c.id === last) ? last : cals[0]?.id ?? null);
    setStage('pick');
  }

  async function continueToConfirm() {
    if (!calendarId) return;
    try {
      const p = await prepareSync(calendarId, events, result?.pageDates ?? null);
      setPrep(p);
      setDeleteIds([]);
      setSyncResult(null);
      setStage('confirm');
    } catch {
      setError('Couldn’t read your calendar. Please try again.');
      setStage('review');
    }
  }

  async function confirmSave() {
    if (!prep) return;
    setSaving(true);
    setError(null);
    try {
      setSyncResult(await applySync(prep, deleteIds));
    } catch {
      setError('Some events couldn’t be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    setStage('review');
    reset();
    navigation.popToTop();
  }

  const calendarName = calendars.find((c) => c.id === calendarId)?.title ?? 'calendar';
  const blank = (): EditableEvent => ({
    key: newEventKey(), title: '', date: days[0] ?? new Date().toISOString().slice(0, 10),
    start: '09:00', end: null, allDay: false, note: null, confidence: 1,
  });

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Pressable onPress={() => { reset(); navigation.popToTop(); }} hitSlop={10}><Text className="text-base font-semibold text-purple">✕ Discard</Text></Pressable>
        <Text className="text-lg font-bold text-navy">Review</Text>
        <Pressable onPress={() => navigation.replace('Camera')} hitSlop={10}><Text className="text-base font-semibold text-purple">Retake</Text></Pressable>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-6">
        <View className="mb-5 flex-row items-center rounded-xl bg-white p-3">
          {photoUri && <Image source={{ uri: photoUri }} className="mr-3 h-20 w-16 rounded-lg" resizeMode="cover" />}
          <View className="flex-1">
            <Text className="text-base font-semibold text-navy">
              {events.length} event{events.length === 1 ? '' : 's'} found
            </Text>
            <Text className="text-sm text-warm-gray">Check them over — tap any event to fix it.</Text>
          </View>
        </View>

        {permissionDenied && (
          <View className="mb-5 rounded-xl bg-rose/40 p-4">
            <Text className="mb-2 text-base text-navy">CloudScribble needs calendar access to save events.</Text>
            <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
          </View>
        )}
        {error && stage === 'review' && <Text className="mb-4 text-base text-red-700">{error}</Text>}

        {grouped.length === 0 && (
          <Text className="my-8 text-center text-base text-warm-gray">No events were found on this page. You can add one below or retake the photo.</Text>
        )}

        {grouped.map(([day, list]) => (
          <View key={day} className="mb-5">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-mauve">{formatDay(day)}</Text>
            {list.map((e) => (
              <Pressable key={e.key} onPress={() => setEditing({ event: e, isNew: false })} className="mb-2 flex-row items-center rounded-xl border-l-4 border-purple bg-white p-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-navy">{e.title}</Text>
                  <Text className="text-sm text-warm-gray">{formatWhen(e)}{e.note ? ` · ${e.note}` : ''}</Text>
                </View>
                {e.confidence < 0.6 && <Text className="mr-2 text-xs font-semibold text-gold">Check</Text>}
                <Text className="text-lg text-purple">✎</Text>
              </Pressable>
            ))}
          </View>
        ))}

        <Button title="+ Add an Event" variant="ghost" onPress={() => setEditing({ event: blank(), isNew: true })} />
      </ScrollView>

      <View className="px-5 pb-3">
        <Button title="Save to Calendar" onPress={startSave} disabled={events.length === 0} />
      </View>

      <EditEventModal
        visible={!!editing}
        event={editing?.event ?? null}
        isNew={editing?.isNew}
        days={days}
        onCancel={() => setEditing(null)}
        onSave={(e) => { upsertEvent(e); setEditing(null); }}
        onDelete={(key) => { removeEvent(key); setEditing(null); }}
      />
      <CalendarPickerModal
        visible={stage === 'pick'}
        calendars={calendars}
        selectedId={calendarId}
        onSelect={setCalendarId}
        onCancel={() => setStage('review')}
        onContinue={continueToConfirm}
      />
      <SyncConfirmModal
        visible={stage === 'confirm'}
        prep={prep}
        calendarName={calendarName}
        deleteIds={deleteIds}
        onToggleDelete={(id) => setDeleteIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
        saving={saving}
        result={syncResult}
        error={error}
        onCancel={() => setStage('pick')}
        onConfirm={confirmSave}
        onDone={finish}
      />
    </SafeAreaView>
  );
}
