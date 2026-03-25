import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

function MainTabs() {
  return (
    <Tab.Navigator
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
          paddingBottom: 10,
          paddingTop: 2,
          height: 70,
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
            return { paddingBottom: 10, paddingTop: 2, height: 70, backgroundColor: '#0D0D0D', borderTopColor: '#333333' };
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
      <StatusBar style="light" />
      <Navigation />
    </AuthProvider>
  );
}