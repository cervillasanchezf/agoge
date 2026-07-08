import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../config/theme';

const GOALS = [
  { value: 'ganar_masa', label: 'Ganar masa muscular' },
  { value: 'perder_grasa', label: 'Perder grasa' },
  { value: 'mantener', label: 'Mantener peso' },
];

export default function CompleteProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [height, setHeight] = useState(user?.height ? String(user.height) : '');
  const [weight, setWeight] = useState(user?.weight ? String(user.weight) : '');
  const [goal, setGoal] = useState(user?.goal || '');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!height || !weight || !goal) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (heightNum < 100 || heightNum > 250) {
      Alert.alert('Error', 'La altura debe estar entre 100 y 250 cm');
      return;
    }

    if (weightNum < 30 || weightNum > 300) {
      Alert.alert('Error', 'El peso debe estar entre 30 y 300 kg');
      return;
    }

    setLoading(true);
    try {
      // Si el usuario eligió una imagen local, subirla primero
      let finalImageUrl = user?.profileImage;
      if (profileImage && profileImage !== user?.profileImage && !profileImage.startsWith('http')) {
        const uploadRes = await profileService.uploadAvatar(profileImage);
        if (uploadRes.success) finalImageUrl = uploadRes.data.profileImage;
      }

      const result = await updateUserProfile({
        profileImage: finalImageUrl,
        height: heightNum,
        weight: weightNum,
        goal,
      });

      if (result.success) {
        if (navigation?.canGoBack()) {
          Alert.alert('¡Perfil actualizado!', 'Tus datos se han guardado correctamente.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } else {
        Alert.alert('Error', result.message || 'Error al actualizar perfil');
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.content}>
        <Text style={styles.title}>Completa tu perfil</Text>
        <Text style={styles.subtitle}>Para personalizar tu experiencia</Text>

        {/* Imagen de perfil */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: profileImage || user?.profileImage }}
            style={styles.profileImage}
          />
          <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
            <Text style={styles.changeImageText}>Cambiar foto</Text>
          </TouchableOpacity>
        </View>

        {/* Altura */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 175"
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
          />
        </View>

        {/* Peso */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 70"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />
        </View>

        {/* Objetivo */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Objetivo</Text>
          {GOALS.map((goalOption) => (
            <TouchableOpacity
              key={goalOption.value}
              style={[
                styles.goalButton,
                goal === goalOption.value && styles.goalButtonSelected,
              ]}
              onPress={() => setGoal(goalOption.value)}
            >
              <Text
                style={[
                  styles.goalButtonText,
                  goal === goalOption.value && styles.goalButtonTextSelected,
                ]}
              >
                {goalOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>Guardar perfil</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  changeImageButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changeImageText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 15,
    fontSize: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  goalButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  goalButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  goalButtonText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  goalButtonTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
