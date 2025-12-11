# Agoge - Aplicación de Login y Registro

Proyecto React Native Expo con backend Node.js/Express que incluye funcionalidad completa de autenticación (Login y Registro).

## Estructura del Proyecto

```
agoge/
├── backend/          # API REST con Express y MongoDB
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   └── routes/
│   └── package.json
│
└── frontend/         # App React Native Expo
    ├── src/
    │   ├── config/
    │   ├── context/
    │   ├── screens/
    │   └── services/
    └── package.json
```

## Instalación

### Backend

1. Navega al directorio del backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno en `.env`:
   - Asegúrate de tener MongoDB instalado y ejecutándose
   - O usa MongoDB Atlas (cloud)

4. Inicia el servidor:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### Frontend

1. Navega al directorio del frontend:
```bash
cd frontend
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura la URL del backend en `src/config/config.js`:
   - Para emulador Android: `http://10.0.2.2:3000/api`
   - Para dispositivo físico: `http://TU_IP:3000/api`

4. Inicia la aplicación:
```bash
npm start
```

## Funcionalidades Implementadas

### Backend
- ✅ API REST con Express
- ✅ Base de datos MongoDB con Mongoose
- ✅ Registro de usuarios con validación
- ✅ Login con autenticación JWT
- ✅ Hash de contraseñas con bcryptjs
- ✅ Validación de datos con express-validator
- ✅ CORS habilitado

### Frontend
- ✅ Pantalla de Login con validación
- ✅ Pantalla de Registro con confirmación de contraseña
- ✅ Navegación con React Navigation
- ✅ Gestión de estado global con Context API
- ✅ Persistencia de sesión con AsyncStorage
- ✅ Pantalla principal protegida
- ✅ Función de cerrar sesión
- ✅ Indicadores de carga (ActivityIndicator)
- ✅ Manejo de errores con alertas

## Tecnologías Utilizadas

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcryptjs
- express-validator

### Frontend
- React Native
- Expo
- React Navigation
- Axios
- AsyncStorage

## Endpoints de la API

### POST /api/auth/register
Registra un nuevo usuario
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123"
}
```

### POST /api/auth/login
Inicia sesión
```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

## Notas Importantes

1. **MongoDB**: Asegúrate de tener MongoDB instalado y ejecutándose localmente, o configura una conexión a MongoDB Atlas.

2. **Red local**: Si vas a probar en un dispositivo físico:
   - Backend y dispositivo deben estar en la misma red WiFi
   - Usa la IP de tu computadora en lugar de localhost
   - Verifica que el firewall permita conexiones al puerto 3000

3. **Seguridad**: 
   - Cambia el JWT_SECRET en producción
   - Nunca subas el archivo .env a Git

## Próximos Pasos

Algunas ideas para expandir el proyecto:
- Recuperación de contraseña
- Verificación de email
- Perfil de usuario editable
- OAuth (Google, Facebook)
- Refresh tokens
- Roles y permisos
- Middleware de autenticación en el backend

## Soporte

Para más información, consulta los README individuales en las carpetas `backend/` y `frontend/`.
