import { registerRootComponent } from 'expo';
import { Platform, Text, TextInput } from 'react-native';

import App from './App';

if (Platform.OS === 'android') {
  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.allowFontScaling = false;

  TextInput.defaultProps = TextInput.defaultProps || {};
  TextInput.defaultProps.allowFontScaling = false;
}

registerRootComponent(App);
