import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { TabBar } from './src/components/TabBar';
import { Screen } from './src/navigation/types';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PulseCheckScreen } from './src/screens/PulseCheckScreen';
import { LogBPScreen } from './src/screens/LogBPScreen';
import { TrendsScreen } from './src/screens/TrendsScreen';
import { HowItWorksScreen } from './src/screens/HowItWorksScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

function Root() {
  const { settings, loaded, theme, updateSettings } = useSettings();
  const [screen, setScreen] = useState<Screen>({ name: 'main', tab: 'home' });
  const [refreshSignal, setRefreshSignal] = useState(0);

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  if (!settings.onboardingComplete) {
    return (
      <OnboardingScreen
        onDone={() => {
          updateSettings({ onboardingComplete: true });
          setScreen({ name: 'main', tab: 'home' });
        }}
      />
    );
  }

  const goHome = () => {
    setRefreshSignal((n) => n + 1);
    setScreen({ name: 'main', tab: 'home' });
  };

  if (screen.name === 'pulseCheck') {
    return <PulseCheckScreen onDone={goHome} leftHandMode={settings.leftHandCameraMode} />;
  }

  if (screen.name === 'logBp') {
    return <LogBPScreen onDone={goHome} onCancel={goHome} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1 }}>
        {screen.tab === 'home' && (
          <HomeScreen
            refreshSignal={refreshSignal}
            onCheckPulse={() => setScreen({ name: 'pulseCheck' })}
            onLogBp={() => setScreen({ name: 'logBp' })}
          />
        )}
        {screen.tab === 'trends' && <TrendsScreen refreshSignal={refreshSignal} />}
        {screen.tab === 'how' && <HowItWorksScreen />}
        {screen.tab === 'settings' && <SettingsScreen onDataCleared={() => setRefreshSignal((n) => n + 1)} />}
      </View>
      <TabBar active={screen.tab} onSelect={(tab) => setScreen({ name: 'main', tab })} theme={theme} textScale={1} />
    </View>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <StatusBar style="auto" />
      <Root />
    </SettingsProvider>
  );
}
