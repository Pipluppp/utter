import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
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
  TaskStatus,
} from '../lib/types';
import { useTasks } from '../providers/TaskProvider';
import { useTheme, type ThemeColors } from '../providers/ThemeProvider';

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

function statusColorValue(status: string, isDark: boolean): string {
  switch (status) {
    case 'completed': return isDark ? '#4c6' : '#090';
    case 'failed': return isDark ? '#f66' : '#d33';
    case 'cancelled': return isDark ? '#f90' : '#e90';
    case 'processing': return isDark ? '#0af' : '#07f';
    default: return isDark ? '#888' : '#999';
  }
}

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.segmentedControl, { backgroundColor: colors.surface }]}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segmentButton, { backgroundColor: value === o.value ? colors.border : 'transparent' }]}
        >
          <Text style={[styles.segmentText, { color: value === o.value ? colors.text : colors.textSecondary }]}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TaskCard — memoized list item
// ---------------------------------------------------------------------------
type TaskCardProps = {
  task: BackendTaskListItem;
  colors: ThemeColors;
  isDark: boolean;
  getStatusText: (status: TaskStatus, providerStatus?: string | null) => string;
  onOpen: (task: BackendTaskListItem) => void;
  onCancel: (task: BackendTaskListItem) => void;
  onDismiss: (task: BackendTaskListItem) => void;
};

const TaskCard = React.memo(function TaskCard({
  task, colors, isDark, getStatusText, onOpen, onCancel, onDismiss,
}: TaskCardProps) {
  const sc = statusColorValue(task.status, isDark);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* Header row */}
      <View style={styles.taskHeader}>
        <View style={styles.taskHeaderLeft}>
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
            {task.title}
          </Text>
          <Text style={[styles.taskStatus, { color: sc }]}>
            {task.status === 'completed'
              ? 'Completed'
              : task.status === 'failed'
                ? 'Failed'
                : task.status === 'cancelled'
                  ? 'Cancelled'
                  : getStatusText(task.status, task.provider_status)}
          </Text>
          {task.subtitle ? (
            <Text style={[styles.taskSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{task.subtitle}</Text>
          ) : null}
        </View>
        <View style={styles.taskHeaderRight}>
          <Text style={[styles.taskTime, { color: colors.textTertiary }]}>{relativeTime(task.created_at)}</Text>
          {task.completed_at ? (
            <Text style={[styles.taskTimeDone, { color: colors.textTertiary }]}>Done {relativeTime(task.completed_at)}</Text>
          ) : null}
        </View>
      </View>

      {/* Metadata row */}
      <View style={styles.taskMeta}>
        {task.voice_name ? (
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>Voice: {task.voice_name}</Text>
        ) : null}
        {task.language ? (
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>Lang: {task.language}</Text>
        ) : null}
        {task.estimated_duration_minutes ? (
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>Est. {task.estimated_duration_minutes.toFixed(1)} min</Text>
        ) : null}
      </View>

      {/* Text preview */}
      {task.text_preview ? (
        <Text style={[styles.taskPreview, { color: colors.textTertiary }]} numberOfLines={2}>
          {task.text_preview}
        </Text>
      ) : null}

      {/* Error */}
      {task.error ? (
        <Text selectable style={[styles.taskError, { color: colors.danger }]}>{task.error}</Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => onOpen(task)}
          style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
        >
          <Text style={[styles.actionText, { color: colors.accent }]}>Open</Text>
        </TouchableOpacity>
        {task.supports_cancel ? (
          <TouchableOpacity
            onPress={() => onCancel(task)}
            style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
          >
            <Text style={[styles.actionText, { color: colors.danger }]}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void onDismiss(task)}
            style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
          >
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function TasksScreen() {
  const { colors, isDark } = useTheme();
  const { cancelTask, dismissTask, getStatusText } = useTasks();
  const isFocused = useIsFocused();

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

  // Live polling every 3s when active filter and screen is focused
  useEffect(() => {
    if (statusFilter !== 'active' || !isFocused) return;
    const id = setInterval(() => { void fetchTasks(); }, 3000);
    return () => clearInterval(id);
  }, [fetchTasks, statusFilter, isFocused]);

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
    <TaskCard
      task={item}
      colors={colors}
      isDark={isDark}
      getStatusText={getStatusText}
      onOpen={handleOpen}
      onCancel={handleCancel}
      onDismiss={handleDismiss}
    />
  ), [colors, isDark, getStatusText, handleOpen, handleCancel, handleDismiss]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error && (
        <Text selectable style={[styles.errorBanner, { color: colors.danger }]}>
          {error}
        </Text>
      )}
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={renderTask}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SegmentedControl options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} colors={colors} />
            <SegmentedControl options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} colors={colors} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No tasks</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {statusFilter === 'active' ? 'No active tasks right now' : 'No recent tasks to show'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.text} size="small" />
            </View>
          ) : nextBefore ? (
            <TouchableOpacity
              onPress={() => void loadMore()}
              style={[styles.loadOlderButton, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.loadOlderText, { color: colors.accent }]}>Load Older</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.skeletonHeader}>
                <View style={styles.taskHeaderLeft}>
                  <View style={[styles.skeletonBar, { backgroundColor: colors.skeletonHighlight, height: 16, width: '60%' }]} />
                  <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: 70, marginTop: 8 }]} />
                </View>
                <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: 50 }]} />
              </View>
              <View style={styles.skeletonMetaRow}>
                <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 10, width: 80 }]} />
                <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 10, width: 60 }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  listHeader: { gap: 8, marginBottom: 12 },

  segmentedControl: { flexDirection: 'row', borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' },
  segmentButton: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },

  card: { borderRadius: 8, borderCurve: 'continuous', padding: 14, marginBottom: 8 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskHeaderLeft: { flex: 1, marginRight: 10 },
  taskHeaderRight: { alignItems: 'flex-end' },
  taskTitle: { fontSize: 14, fontWeight: '600' },
  taskStatus: { fontSize: 12, marginTop: 4 },
  taskSubtitle: { fontSize: 13, marginTop: 4 },
  taskTime: { fontSize: 11 },
  taskTimeDone: { fontSize: 11, marginTop: 2 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  taskMetaText: { fontSize: 12 },
  taskPreview: { fontSize: 12, marginTop: 6 },
  taskError: { fontSize: 12, marginTop: 6 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' },
  actionText: { fontSize: 13, fontWeight: '600' },

  errorBanner: { fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginTop: 8 },

  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, marginTop: 8 },

  footerLoading: { paddingVertical: 16, alignItems: 'center' },
  loadOlderButton: { borderRadius: 8, borderCurve: 'continuous', paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  loadOlderText: { fontSize: 14, fontWeight: '600' },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 80 },

  skeletonHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonBar: { borderRadius: 4 },
  skeletonMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
