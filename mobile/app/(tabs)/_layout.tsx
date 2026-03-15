import { Tabs } from 'expo-router';
import { useTasks } from '../../providers/TaskProvider';

export default function TabLayout() {
  const { activeCount } = useTasks();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#000', borderTopColor: '#222' },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Voices' }} />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#0af', fontSize: 10 },
        }}
      />
      <Tabs.Screen name="design" options={{ title: 'Design' }} />
    </Tabs>
  );
}
