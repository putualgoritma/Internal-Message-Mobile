import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme/colors';

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({message}: ErrorBannerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFE8E8',
    borderColor: '#F7B7B7',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
});
