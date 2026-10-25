/**
 * SyncConfirmModal — shows exactly what saving will do before anything changes:
 * add / update counts, app-created events no longer on the page (opt-in delete), and
 * "write in your planner" reminders for events from elsewhere (read-only).
 */
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { PreparedSync, SyncResult } from '../../scan/calendar';
import { formatDay, formatWhen } from '../../scan/format';
import { Button } from '../ui/Button';

interface Props {
  visible: boolean;
  prep: PreparedSync | null;
  calendarName: string;
  deleteIds: string[];
  onToggleDelete: (id: string) => void;
  saving: boolean;
  result: SyncResult | null;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onDone: () => void;
}

export function SyncConfirmModal(p: Props) {
  if (!p.prep) return null;
  const { plan } = p.prep;
  const nothingToDo = !plan.create.length && !plan.update.length && !plan.deleteCandidates.length;

  return (
    <Modal visible={p.visible} animationType="slide" transparent onRequestClose={p.onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-3xl bg-white px-5 pb-10 pt-5">
          <ScrollView showsVerticalScrollIndicator={false}>
            {p.result ? (
              <View className="items-center py-6">
                <Text className="mb-2 text-5xl">✅</Text>
                <Text className="mb-2 text-2xl font-bold text-navy">Saved to {p.calendarName}</Text>
                <Text className="text-center text-base text-warm-gray">
                  {p.result.created} added · {p.result.updated} updated{p.result.deleted ? ` · ${p.result.deleted} removed` : ''}
                </Text>
              </View>
            ) : (
              <>
                <Text className="mb-1 text-2xl font-bold text-navy">Save to {p.calendarName}</Text>
                <Text className="mb-5 text-base text-warm-gray">
                  {nothingToDo
                    ? 'Your calendar already matches this page.'
                    : [
                        plan.create.length && `${plan.create.length} new event${plan.create.length > 1 ? 's' : ''}`,
                        plan.update.length && `${plan.update.length} update${plan.update.length > 1 ? 's' : ''}`,
                        plan.unchanged.length && `${plan.unchanged.length} already saved`,
                      ].filter(Boolean).join(' · ')}
                </Text>

                {plan.deleteCandidates.length > 0 && (
                  <View className="mb-5 rounded-xl bg-peach/60 p-4">
                    <Text className="mb-1 text-base font-semibold text-navy">No longer on this page</Text>
                    <Text className="mb-3 text-sm text-warm-gray">CloudScribble added these from this page before. Tick any you want removed from your calendar.</Text>
                    {plan.deleteCandidates.map((r) => {
                      const on = p.deleteIds.includes(r.eventId);
                      return (
                        <Pressable key={r.eventId} onPress={() => p.onToggleDelete(r.eventId)} className="mb-2 flex-row items-center">
                          <View className={`mr-3 h-6 w-6 items-center justify-center rounded border-2 ${on ? 'border-red-700 bg-red-700' : 'border-warm-gray'}`}>
                            {on && <Text className="text-xs font-bold text-white">✓</Text>}
                          </View>
                          <Text className="flex-1 text-base text-navy">
                            {r.title} <Text className="text-warm-gray">· {formatDay(r.date)}</Text>
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {plan.writeInPlanner.length > 0 && (
                  <View className="mb-5 rounded-xl bg-gold-pale/60 p-4">
                    <Text className="mb-1 text-base font-semibold text-navy">✍️ Write in your planner</Text>
                    <Text className="mb-3 text-sm text-warm-gray">These are in your calendar for these days but not on the page.</Text>
                    {plan.writeInPlanner.map((e) => (
                      <Text key={e.id} className="mb-1 text-base text-navy">
                        • {e.title} <Text className="text-warm-gray">· {formatDay(e.date)}, {formatWhen({ allDay: !e.start, start: e.start, end: null })}</Text>
                      </Text>
                    ))}
                  </View>
                )}

                {p.error && <Text className="mb-4 text-base text-red-700">{p.error}</Text>}
              </>
            )}
          </ScrollView>

          {p.result ? (
            <Button title="Done" onPress={p.onDone} />
          ) : (
            <View className="flex-row gap-3">
              <Button title="Back" variant="ghost" onPress={p.onCancel} className="flex-1" disabled={p.saving} />
              <Button
                title={nothingToDo ? 'Done' : 'Save'}
                onPress={nothingToDo ? p.onDone : p.onConfirm}
                loading={p.saving}
                className="flex-1"
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
