import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Easing } from 'react-native';

interface TabTransitionProps {
  tabKey: string;
  children: React.ReactNode;
}

const TAB_ORDER = ['workout', 'analytics', 'history', 'library'];

export const TabTransition: React.FC<TabTransitionProps> = ({ tabKey, children }) => {
  const prevTabRef = useRef<string>(tabKey);
  const animValue = useRef(new Animated.Value(1)).current;
  const slideDirectionRef = useRef<number>(1); // 1 = slide from right (+X), -1 = slide from left (-X)

  useEffect(() => {
    const prevIndex = TAB_ORDER.indexOf(prevTabRef.current);
    const newIndex = TAB_ORDER.indexOf(tabKey);

    if (prevIndex !== -1 && newIndex !== -1 && prevIndex !== newIndex) {
      slideDirectionRef.current = newIndex > prevIndex ? 1 : -1;
    }
    prevTabRef.current = tabKey;

    animValue.setValue(0);

    Animated.timing(animValue, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [tabKey]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirectionRef.current * 36, 0],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.1, 0.7, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
