import { Tabs } from 'expo-router';
import { useTasks } from '../../providers/TaskProvider';
import { useTheme } from '../../providers/ThemeProvider';

export default function TabLayout() {
  const { activeCount } = useTasks();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.skeletonHighlight },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Voices' }} />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="design" options={{ title: 'Design' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
    </Tabs>
  );
}
