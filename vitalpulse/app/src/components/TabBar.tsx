import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Theme } from '../theme';
import { MainTab } from '../navigation/types';

const TABS: { key: MainTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'trends', label: 'Trends', icon: '📈' },
  { key: 'how', label: 'How it works', icon: '📖' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

export function TabBar({ active, onSelect, theme, textScale }: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
  theme: Theme;
  textScale: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: theme.line,
        backgroundColor: theme.paper,
        paddingTop: 10,
        paddingBottom: 22,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={{ alignItems: 'center', gap: 3, minWidth: 60, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
            <Text style={{ fontSize: 11 * textScale, fontWeight: '600', color: isActive ? theme.teal : theme.inkSoft }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
