import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Botón editar */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityLabel="Editar perfil"
        >
          <Ionicons name="pencil-outline" size={15} color="#fff" />
        </TouchableOpacity>

        {/* Foto + nombre */}
        <View style={styles.profileRow}>
          <View style={styles.avatarWrapper}>
            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={25} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
        </View>

        {/* Opciones de perfil */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Historial')}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name="calendar-outline" size={20} color="#8B0000" />
            </View>
            <Text style={styles.menuLabel}>Historial</Text>
            <Ionicons name="chevron-forward" size={18} color="#6A6A6A" />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 16,
  },
  menuSection: {
    marginTop: 28,
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1A0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#EAEAEA',
  },
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#8B0000',
    borderRadius: 24,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarWrapper: {
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#8B0000',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8B0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#EAEAEA',
    flexShrink: 1,
  },
});
