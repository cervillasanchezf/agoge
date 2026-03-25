import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';

const logoXml = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 846 246" width="846px" height="246px" xmlns:xlink="http://www.w3.org/1999/xlink">
<g><path fill-rule="evenodd" fill="#8B0000" d="M 312.5,25.5 C 313.552,25.3505 314.552,25.5172 315.5,26C 322,31.8333 328.167,38 334,44.5C 334.667,45.1667 334.667,45.8333 334,46.5C 307.167,73.3333 280.333,100.167 253.5,127C 274.667,145.5 295.833,164 317,182.5C 317.5,169.504 317.667,156.504 317.5,143.5C 309.5,143.5 301.5,143.5 293.5,143.5C 293.553,133.953 293.22,124.619 292.5,115.5C 310.167,115.5 327.833,115.5 345.5,115.5C 345.83,153.073 345.496,190.573 344.5,228C 337.5,228.667 330.5,228.667 323.5,228C 289.129,197.294 254.463,166.961 219.5,137C 216.65,134.318 213.984,131.484 211.5,128.5C 244.568,94.9328 277.734,61.5994 311,28.5C 311.513,27.4734 312.013,26.4734 312.5,25.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#8B0000" d="M 635.5,25.5 C 636.552,25.3505 637.552,25.5172 638.5,26C 643.333,30.8333 648.167,35.6667 653,40.5C 654.602,42.3687 655.602,44.3687 656,46.5C 629.113,73.3874 602.279,100.221 575.5,127C 596.667,145.5 617.833,164 639,182.5C 639.638,181.391 640.138,180.225 640.5,179C 640.767,167.199 640.434,155.365 639.5,143.5C 631.5,143.5 623.5,143.5 615.5,143.5C 615.5,134.167 615.5,124.833 615.5,115.5C 632.833,115.5 650.167,115.5 667.5,115.5C 667.5,153.167 667.5,190.833 667.5,228.5C 659.721,228.932 652.054,228.432 644.5,227C 609.463,195.628 574.13,164.628 538.5,134C 536.773,132.611 535.439,130.944 534.5,129C 536.206,126.428 538.039,123.928 540,121.5C 571.953,89.7129 603.787,57.7129 635.5,25.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#8B0000" d="M 129.5,28.5 C 133.921,28.9567 138.587,29.29 143.5,29.5C 165.33,95.4896 187.663,161.323 210.5,227C 198.995,228.477 187.328,228.977 175.5,228.5C 171.019,212.225 165.852,196.225 160,180.5C 154.096,187.074 147.596,192.908 140.5,198C 127.167,198.667 113.833,198.667 100.5,198C 93.3725,192.541 86.5392,186.708 80,180.5C 74.5123,196.295 69.0123,212.128 63.5,228C 52.505,228.5 41.505,228.667 30.5,228.5C 52.7608,163.186 74.5941,97.5196 96,31.5C 107.091,29.8576 118.258,28.8576 129.5,28.5 Z M 119.5,68.5 C 124.311,71.4092 128.978,74.5759 133.5,78C 130.76,86.4537 128.094,94.9537 125.5,103.5C 126.002,104.521 126.668,104.688 127.5,104C 128.723,101.056 130.556,98.556 133,96.5C 148.785,101.794 157.285,112.794 158.5,129.5C 158.405,134.414 158.239,139.414 158,144.5C 156.704,147.951 155.204,151.285 153.5,154.5C 155.299,159.378 156.132,164.378 156,169.5C 149.974,179.859 141.64,187.859 131,193.5C 131.67,180.134 133.003,166.8 135,153.5C 135.374,152.584 135.874,151.75 136.5,151C 140.983,148.667 145.316,146.167 149.5,143.5C 150.6,139.558 150.767,135.558 150,131.5C 141.759,135.038 133.592,138.705 125.5,142.5C 125.072,147.456 124.905,152.456 125,157.5C 121.667,162.833 118.333,162.833 115,157.5C 114.336,153.304 114.503,149.138 115.5,145C 115.561,143.289 114.894,141.956 113.5,141C 106.389,138.028 99.2227,135.195 92,132.5C 91.228,132.645 90.5613,132.978 90,133.5C 89.8859,136.833 90.2192,140.166 91,143.5C 95.5038,146.42 100.171,149.086 105,151.5C 106.437,164.18 107.937,176.847 109.5,189.5C 109.167,190.5 108.833,191.5 108.5,192.5C 101.899,188.068 95.732,183.068 90,177.5C 87.3136,174.125 85.1469,170.459 83.5,166.5C 86.6311,159.194 86.1311,152.194 82,145.5C 78.5104,128.937 82.6771,114.771 94.5,103C 98.4622,100.436 102.629,98.269 107,96.5C 108.833,98.8333 110.667,101.167 112.5,103.5C 112.833,102.833 113.167,102.167 113.5,101.5C 111.502,93.838 109.502,86.1714 107.5,78.5C 107.608,77.5581 107.941,76.7247 108.5,76C 112.345,73.637 116.011,71.137 119.5,68.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#8B0000" d="M 441.5,28.5 C 442.239,28.369 442.906,28.5357 443.5,29C 470.689,62.0216 497.689,95.1883 524.5,128.5C 498.271,162.73 470.937,196.064 442.5,228.5C 414.063,196.064 386.729,162.73 360.5,128.5C 387.523,95.1476 414.523,61.8143 441.5,28.5 Z M 441.5,75.5 C 456.363,93.355 471.363,111.188 486.5,129C 472.355,146.643 457.688,163.81 442.5,180.5C 428.196,163.191 413.863,145.858 399.5,128.5C 413.758,110.955 427.758,93.288 441.5,75.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#8B0000" d="M 789.5,26.5 C 791.371,26.8588 792.871,27.8588 794,29.5C 798.64,36.3066 803.473,42.9732 808.5,49.5C 781.645,71.5229 754.645,93.3562 727.5,115C 751.84,115.167 776.174,115.667 800.5,116.5C 801.744,125.48 801.744,134.48 800.5,143.5C 778.164,143.333 755.831,143.5 733.5,144C 759.62,163.785 785.453,183.952 811,204.5C 805.798,213.168 799.798,221.501 793,229.5C 760.333,203.5 727.667,177.5 695,151.5C 694.333,135.5 694.333,119.5 695,103.5C 726.689,77.9692 758.189,52.3025 789.5,26.5 Z"/></g>
</svg>`;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Error', result.message || 'Error al iniciar sesión');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <SvgXml xml={logoXml} width="220" height="64" style={styles.logo} />
        <Text style={styles.subtitle}>Inicia sesión en tu cuenta</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#7A7A7A"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Contraseña"
              placeholderTextColor="#7A7A7A"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#6A6A6A"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>¿No tienes cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Regístrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#EAEAEA',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: '#8B0000',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: '#9A9A9A',
    fontSize: 14,
  },
  registerLink: {
    color: '#8B0000',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
