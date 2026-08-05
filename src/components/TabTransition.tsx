import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface TabTransitionProps {
  tabKey: string;
  children: React.ReactNode;
}

export const TabTransition: React.FC<TabTransitionProps> = ({ tabKey, children }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.985)).current;
  const translateYAnim = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.985);
    translateYAnim.setValue(4);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tabKey]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
          ],
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
