import { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  FolderKanban,
  Upload,
  FileText,
} from 'lucide-react-native';

const TAB_ICON_SIZE = 22;
const TAB_ACTIVE_COLOR = '#2563eb';
const TAB_INACTIVE_COLOR = '#94a3b8';
const TAB_BG_ACTIVE = '#eff6ff';

function AnimatedTabIcon({ icon: Icon, label, focused }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const translateYAnim = useRef(new Animated.Value(focused ? -2 : 0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1 : 0.85,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
    Animated.spring(translateYAnim, {
      toValue: focused ? -2 : 0,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const isUpload = label === 'Upload';

  return (
    <View style={styles.tabItemWrapper}>
      {focused && !isUpload ? (
        <View style={styles.activePill} />
      ) : null}
      <Animated.View
        style={[
          styles.tabItem,
          isUpload && styles.uploadTabItem,
          focused && !isUpload && styles.tabItemFocused,
          {
            transform: [
              { scale: isUpload ? 1 : scaleAnim },
              { translateY: isUpload ? 0 : translateYAnim },
            ],
          },
        ]}
      >
        {isUpload ? (
          <View style={styles.uploadButton}>
            <Icon
              size={24}
              color="#ffffff"
              strokeWidth={2.5}
            />
          </View>
        ) : (
          <Icon
            size={TAB_ICON_SIZE}
            color={focused ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR}
            strokeWidth={focused ? 2.5 : 1.5}
          />
        )}
        {!isUpload ? (
          <Text
            style={[
              styles.tabLabel,
              focused && styles.tabLabelFocused,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : (
          <Text style={styles.uploadLabel}>
            {label}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, 6) },
        ],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon icon={LayoutDashboard} label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon icon={FolderKanban} label="Categories" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon icon={Upload} label="Upload" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon icon={FileText} label="Documents" focused={focused} />
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
    borderTopWidth: 0,
    paddingTop: 4,
    height: 68,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 72,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabItemFocused: {
    backgroundColor: TAB_BG_ACTIVE,
  },
  tabLabel: {
    fontSize: 10,
    color: TAB_INACTIVE_COLOR,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    color: TAB_ACTIVE_COLOR,
    fontWeight: '700',
  },
  activePill: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: TAB_ACTIVE_COLOR,
  },
  uploadTabItem: {
    marginTop: -16,
  },
  uploadButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: TAB_ACTIVE_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TAB_ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadLabel: {
    fontSize: 9,
    color: TAB_ACTIVE_COLOR,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
