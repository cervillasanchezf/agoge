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

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  editButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#6366f1',
    borderRadius: 24,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarWrapper: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6366f1',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1,
  },
});
