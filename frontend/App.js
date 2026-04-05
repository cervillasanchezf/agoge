import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CompleteProfileScreen from './src/screens/CompleteProfileScreen';
import HomeScreen from './src/screens/HomeScreen';
import TrainningScreen from './src/screens/TrainningScreen';
import NewTrainningScreen from './src/screens/NewTrainningScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ExercisePickerScreen from './src/screens/ExercisePickerScreen';
import ActiveSessionScreen from './src/screens/ActiveSessionScreen';
import HistorialScreen from './src/screens/HistorialScreen';
import SessionDetailScreen from './src/screens/SessionDetailScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ActiveSessionProvider, useActiveSession } from './src/context/ActiveSessionContext';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


function TrainningStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1F1F1F',
        },
        headerTintColor: '#EAEAEA',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="TrainningList"
        component={TrainningScreen}
        options={{ title: 'Entrenamiento' }}
      />
      <Stack.Screen
        name="NewTrainning"
        component={NewTrainningScreen}
        options={({ route }) => ({
          title: route.params?.editTraining ? 'Editar Entrenamiento' : 'Nuevo Entrenamiento',
        })}
      />
      <Stack.Screen
        name="ExercisePicker"
        component={ExercisePickerScreen}
        options={{ title: 'Añadir Ejercicio' }}
      />
      <Stack.Screen
        name="ActiveSession"
        component={ActiveSessionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}


function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1F1F1F',
        },
        headerTintColor: '#EAEAEA',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={CompleteProfileScreen}
        options={{ title: 'Editar Perfil' }}
      />
      <Stack.Screen
        name="Historial"
        component={HistorialScreen}
        options={{ title: 'Historial' }}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ title: 'Detalle de sesión' }}
      />
    </Stack.Navigator>
  );
}

function SessionBanner({ session, tabNavigation, onDiscard }) {
  const [elapsed, setElapsed] = useState(
    () => Math.round((Date.now() - session.startTimestamp) / 1000)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - session.startTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [session.startTimestamp]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return (
    <TouchableOpacity
      style={bannerStyles.container}
      onPress={() =>
        tabNavigation.navigate('TrainningTab', {
          screen: 'ActiveSession',
          params: { trainingId: session.trainingId, trainingName: session.trainingName },
        })
      }
      activeOpacity={0.85}
    >
      <View style={bannerStyles.leftBorder} />
      <View style={bannerStyles.info}>
        <Text style={bannerStyles.label}>EN CURSO</Text>
        <Text style={bannerStyles.name} numberOfLines={1}>{session.trainingName}</Text>
      </View>
      <View style={bannerStyles.timerRow}>
        <Ionicons name="time-outline" size={14} color="#8B0000" />
        <Text style={bannerStyles.timerText}>{formatTime(elapsed)}</Text>
      </View>
      <TouchableOpacity
        onPress={onDiscard}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={bannerStyles.discardBtn}
      >
        <Ionicons name="close-circle-outline" size={24} color="#CC3333" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 85,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  leftBorder: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: '#8B0000',
  },
  info: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B0000',
    letterSpacing: 1,
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAEAEA',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  timerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B0000',
    fontVariant: ['tabular-nums'],
  },
  discardBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});


function MainTabs() {
  const { session, discardSession } = useActiveSession();

  const handleDiscard = () => {
    Alert.alert(
      'Descartar entrenamiento',
      `¿Descartar "${session?.trainingName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: discardSession },
      ]
    );
  };

  return (
    <Tab.Navigator
      tabBar={(props) => {
        const focusedTabRoute = props.state.routes[props.state.index];
        const currentScreen = getFocusedRouteNameFromRoute(focusedTabRoute) ?? '';
        const hiddenRoutes = ['NewTrainning', 'ExercisePicker', 'ActiveSession'];
        const showBanner = !!session && !hiddenRoutes.includes(currentScreen);
        return (
          <View style={{ overflow: 'visible' }}>
            {showBanner && (
              <SessionBanner
                session={session}
                tabNavigation={props.navigation}
                onDiscard={handleDiscard}
              />
            )}
            <BottomTabBar {...props} />
          </View>
        );
      }}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1F1F1F',
        },
        headerTintColor: '#EAEAEA',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: '#8B0000',
        tabBarInactiveTintColor: '#6A6A6A',
        tabBarStyle: {
          paddingBottom: 25,
          paddingTop: 2,
          height: 75,
          backgroundColor: '#0D0D0D',
          borderTopColor: '#333333',
        },
        tabBarLabelStyle: {
          marginTop: -10,
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TrainningTab"
        component={TrainningStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('TrainningTab', { screen: 'TrainningList' });
          },
        })}
        options={({ route }) => ({
          headerShown: false,
          tabBarLabel: 'Entrenamiento',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
          unmountOnBlur: true,
          tabBarStyle: (() => {
            const routeName = getFocusedRouteNameFromRoute(route) ?? 'TrainningList';
            if (routeName === 'NewTrainning' || routeName === 'ExercisePicker') {
              return { display: 'none' };
            }
            return { paddingBottom: 25, paddingTop: 2, height: 75, backgroundColor: '#0D0D0D', borderTopColor: '#333333' };
          })(),
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}


function Navigation() {
  const { user } = useAuth();


  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1F1F1F',
          },
          headerTintColor: '#EAEAEA',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {user ? (
          user.profileCompleted ? (
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
          ) : (
            <Stack.Screen
              name="CompleteProfile"
              component={CompleteProfileScreen}
              options={{ title: 'Completa tu perfil', headerLeft: () => null }}
            />
          )
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ title: 'Iniciar Sesión', headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Registro' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <ActiveSessionProvider>
        <StatusBar style="light" />
        <Navigation />
      </ActiveSessionProvider>
    </AuthProvider>
  );
}