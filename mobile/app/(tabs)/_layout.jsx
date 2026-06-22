import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  FolderKanban,
  Upload,
  FileText,
} from 'lucide-react-native';

function TabIcon({ icon: Icon, label, focused }) {
  return (
    <View style={styles.tabItem}>
      <Icon
        size={focused ? 22 : 20}
        color={focused ? '#2563eb' : '#94a3b8'}
        strokeWidth={focused ? 2.5 : 1.5}
      />
      <Text
        style={[
          styles.tabLabel,
          focused && styles.tabLabelFocused,
        ]}
      >
        {label}
      </Text>
      {focused ? <View style={styles.activeIndicator} /> : null}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={LayoutDashboard} label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={FolderKanban} label="Categories" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Upload} label="Upload" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={FileText} label="Documents" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 10,
    height: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 6,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelFocused: {
    color: '#2563eb',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#2563eb',
  },
});
