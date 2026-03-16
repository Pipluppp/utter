import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiJson } from '../lib/api';
import { hapticDelete, hapticLight } from '../lib/haptics';
import type {
  BackendTaskListItem,
  TaskListResponse,
  TaskListStatus,
  TaskListType,
} from '../lib/types';
import { useTasks } from '../providers/TaskProvider';

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: { value: TaskListStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminal', label: 'Recent' },
];

const TYPE_OPTIONS: { value: TaskListType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'generate', label: 'Generate' },
  { value: 'design_preview', label: 'Design' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#4c6';
    case 'failed': return '#f66';
    case 'cancelled': return '#f90';
    case 'processing': return '#0af';
    default: return '#888';
  }
}

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: value === o.value ? '#333' : 'transparent' }}
        >
          <Text style={{ color: value === o.value ? '#fff' : '#888', fontSize: 13, fontWeight: '600' }}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function TasksScreen() {
  const { cancelTask, dismissTask, getStatusText } = useTasks();

  const [statusFilter, setStatusFilter] = useState<TaskListStatus>('active');
  const [typeFilter, setTypeFilter] = useState<TaskListType>('all');
  const [tasks, setTasks] = useState<BackendTaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  // Track active component for cleanup
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({
      status: statusFilter,
      type: typeFilter,
      limit: '20',
    });
    return params.toString();
  }, [statusFilter, typeFilter]);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const response = await apiJson<TaskListResponse>(`/api/tasks?${filterQuery}`);
      if (!activeRef.current) return;
      setTasks(response.tasks);
      setNextBefore(response.next_before);
    } catch (e) {
      if (!activeRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      if (activeRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filterQuery]);

  // Initial load + reload on filter change
  useEffect(() => {
    setLoading(true);
    void fetchTasks();
  }, [fetchTasks]);

  // Live polling every 3s when active filter
  useEffect(() => {
    if (statusFilter !== 'active') return;
    const id = setInterval(() => { void fetchTasks(); }, 3000);
    return () => clearInterval(id);
  }, [fetchTasks, statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchTasks();
  }, [fetchTasks]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        type: typeFilter,
        limit: '20',
        before: nextBefore,
      });
      const response = await apiJson<TaskListResponse>(`/api/tasks?${params}`);
      setTasks((prev) => [...prev, ...response.tasks]);
      setNextBefore(response.next_before);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore, statusFilter, typeFilter]);

  // ---- Actions ----
  const handleCancel = useCallback((task: BackendTaskListItem) => {
    Alert.alert('Cancel Task', `Cancel "${task.title}"?`, [
      { text: 'Keep Running', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          void hapticDelete();
          const ok = await cancelTask(task.id);
          if (!ok) {
            Alert.alert('Error', 'Failed to cancel task');
            return;
          }
          void fetchTasks();
        },
      },
    ]);
  }, [cancelTask, fetchTasks]);

  const handleDismiss = useCallback(async (task: BackendTaskListItem) => {
    void hapticLight();
    const ok = await dismissTask(task.id);
    if (!ok) {
      Alert.alert('Error', 'Failed to dismiss task');
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  }, [dismissTask]);

  const handleOpen = useCallback((task: BackendTaskListItem) => {
    // Navigate to the source tab
    const page = task.origin_page;
    if (page === 'generate' || page === '/generate') {
      router.navigate('/(tabs)/generate');
    } else if (page === 'design' || page === 'design_preview' || page === '/design') {
      router.navigate('/(tabs)/design');
    } else {
      router.navigate('/(tabs)');
    }
  }, []);

  // ---- Render ----
  const renderTask = useCallback(({ item }: { item: BackendTaskListItem }) => (
    <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 14, marginBottom: 8 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={{ color: statusColor(item.status), fontSize: 12, marginTop: 4 }}>
            {item.status === 'completed'
              ? 'Completed'
              : item.status === 'failed'
                ? 'Failed'
                : item.status === 'cancelled'
                  ? 'Cancelled'
                  : getStatusText(item.status, item.provider_status)}
          </Text>
          {item.subtitle ? (
            <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }} numberOfLines={1}>{item.subtitle}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: '#666', fontSize: 11 }}>{relativeTime(item.created_at)}</Text>
          {item.completed_at ? (
            <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>Done {relativeTime(item.completed_at)}</Text>
          ) : null}
        </View>
      </View>

      {/* Metadata row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {item.voice_name ? (
          <Text style={{ color: '#666', fontSize: 12 }}>Voice: {item.voice_name}</Text>
        ) : null}
        {item.language ? (
          <Text style={{ color: '#666', fontSize: 12 }}>Lang: {item.language}</Text>
        ) : null}
        {item.estimated_duration_minutes ? (
          <Text style={{ color: '#666', fontSize: 12 }}>Est. {item.estimated_duration_minutes.toFixed(1)} min</Text>
        ) : null}
      </View>

      {/* Text preview */}
      {item.text_preview ? (
        <Text style={{ color: '#555', fontSize: 12, marginTop: 6 }} numberOfLines={2}>
          {item.text_preview}
        </Text>
      ) : null}

      {/* Error */}
      {item.error ? (
        <Text selectable style={{ color: '#f44', fontSize: 12, marginTop: 6 }}>{item.error}</Text>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => handleOpen(item)}
          style={{ backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
        >
          <Text style={{ color: '#0af', fontSize: 13, fontWeight: '600' }}>Open</Text>
        </TouchableOpacity>
        {item.supports_cancel ? (
          <TouchableOpacity
            onPress={() => handleCancel(item)}
            style={{ backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
          >
            <Text style={{ color: '#f44', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void handleDismiss(item)}
            style={{ backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
          >
            <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [getStatusText, handleOpen, handleCancel, handleDismiss]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {error && (
        <Text selectable style={{ color: '#f44', fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginTop: 8 }}>
          {error}
        </Text>
      )}
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={renderTask}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 12 }}>
            <SegmentedControl options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            <SegmentedControl options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: '#888', fontSize: 16, fontWeight: '600' }}>No tasks</Text>
              <Text style={{ color: '#555', fontSize: 14, marginTop: 8 }}>
                {statusFilter === 'active' ? 'No active tasks right now' : 'No recent tasks to show'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          ) : nextBefore ? (
            <TouchableOpacity
              onPress={() => void loadMore()}
              style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>Load Older</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 80 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 14, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ backgroundColor: '#222', height: 16, width: '60%', borderRadius: 4 }} />
                  <View style={{ backgroundColor: '#1a1a1a', height: 12, width: 70, borderRadius: 4, marginTop: 8 }} />
                </View>
                <View style={{ backgroundColor: '#1a1a1a', height: 12, width: 50, borderRadius: 4 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <View style={{ backgroundColor: '#1a1a1a', height: 10, width: 80, borderRadius: 4 }} />
                <View style={{ backgroundColor: '#1a1a1a', height: 10, width: 60, borderRadius: 4 }} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
