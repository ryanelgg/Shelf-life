import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { TabBar } from './components/TabBar';
import { PantryScreen } from './screens/PantryScreen';
import { AddItemScreen } from './screens/AddItemScreen';
import { CookScreen } from './screens/CookScreen';
import { ImpactScreen } from './screens/ImpactScreen';
import { PlanScreen } from './screens/PlanScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export default function App() {
  const { user, activeTab, theme, showSettings } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', '#faf7f2');
    }
  }, [theme]);

  if (!user?.onboardingComplete) {
    return (
      <div data-theme={theme} style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <OnboardingFlow />
      </div>
    );
  }

  const screens = {
    pantry: <PantryScreen />,
    add: <AddItemScreen />,
    cook: <CookScreen />,
    impact: <ImpactScreen />,
    plan: <PlanScreen />,
  };

  return (
    <div data-theme={theme} style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div key={activeTab} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {screens[activeTab]}
      </div>
      <TabBar />
      {showSettings && <SettingsScreen />}
    </div>
  );
}
