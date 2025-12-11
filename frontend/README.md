# Agoge Frontend

Aplicación móvil React Native Expo con autenticación de usuarios.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar la URL del backend:
   - Edita `src/config/config.js`
   - Si vas a probar en un dispositivo físico, cambia `localhost` por la IP de tu computadora

3. Iniciar la aplicación:
```bash
npm start
```

## Funcionalidades

- ✅ Pantalla de Login
- ✅ Pantalla de Registro
- ✅ Autenticación con JWT
- ✅ Persistencia de sesión con AsyncStorage
- ✅ Navegación con React Navigation
- ✅ Pantalla principal protegida
- ✅ Cerrar sesión

## Estructura del proyecto

```
frontend/
├── src/
│   ├── config/        # Configuración (URL API)
│   ├── context/       # Context API para autenticación
│   ├── screens/       # Pantallas de la app
│   └── services/      # Servicios API
├── App.js             # Componente principal
└── package.json
```

## Tecnologías

- React Native
- Expo
- React Navigation
- Axios
- AsyncStorage

## Notas importantes

- Asegúrate de que el backend esté ejecutándose antes de probar la app
- Para dispositivos físicos, usa tu IP local en lugar de localhost
- Puedes probar con Expo Go en tu teléfono móvil
