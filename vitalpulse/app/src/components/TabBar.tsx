import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FONTS, Theme } from '../theme';
import { MainTab } from '../navigation/types';
import { Icon, IconName } from './Icon';

const TABS: { key: MainTab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'trends', label: 'Trends', icon: 'trend' },
  { key: 'how', label: 'How it works', icon: 'book' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
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
        const color = isActive ? theme.teal : theme.inkFaint;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={{ alignItems: 'center', gap: 4, minWidth: 60, paddingVertical: 4 }}
          >
            <Icon name={tab.icon} size={21} color={color} />
            <Text style={{ fontSize: 11 * textScale, fontFamily: FONTS.bodyBold, color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
