import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const dotsRef = useRef(null);

  const openMenu = () => {
    dotsRef.current?.measure((fx, fy, w, h, px, py) => {
      setMenuPos({ top: py + h + 4, right: 16 });
      setMenuVisible(true);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Foto + nombre + 3 puntos */}
        <View style={styles.profileRow}>
          <View style={styles.avatarWrapper}>
            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <TouchableOpacity
            ref={dotsRef}
            style={styles.dotsButton}
            onPress={openMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Opciones de perfil */}
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Historial')}
            activeOpacity={0.7}
          >
            <View style={styles.gridIconWrap}>
              <Ionicons name="calendar-outline" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.gridLabel}>Historial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => navigation.navigate('Medidas')}
            activeOpacity={0.7}
          >
            <View style={styles.gridIconWrap}>
              <Ionicons name="body-outline" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.gridLabel}>Medidas</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Dropdown menú */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.dropdown, { top: menuPos.top, right: menuPos.right }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); navigation.navigate('EditProfile'); }}
            >
              <Ionicons name="pencil-outline" size={16} color={COLORS.textPrimary} />
              <Text style={styles.dropdownText}>Editar perfil</Text>
            </TouchableOpacity>
            <View style={styles.dropdownDivider} />
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setMenuVisible(false); logout(); }}
            >
              <Ionicons name="log-out-outline" size={16} color={COLORS.danger} />
              <Text style={[styles.dropdownText, { color: COLORS.danger }]}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  grid: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 28,
  },
  gridItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
  },
  gridIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dotsButton: {
    marginLeft: 'auto',
    padding: 6,
  },
  avatarWrapper: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
});
