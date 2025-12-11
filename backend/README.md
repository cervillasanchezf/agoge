# Agoge Backend

Backend API para la aplicación Agoge con autenticación de usuarios.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno en `.env`:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/agoge
JWT_SECRET=tu_clave_secreta
```

3. Asegurarse de tener MongoDB instalado y ejecutándose localmente o usar MongoDB Atlas.

## Ejecutar el servidor

### Modo desarrollo (con auto-reload):
```bash
npm run dev
```

### Modo producción:
```bash
npm start
```

## Endpoints disponibles

### POST /api/auth/register
Registrar nuevo usuario
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "password123"
}
```

### POST /api/auth/login
Iniciar sesión
```json
{
  "email": "juan@example.com",
  "password": "password123"
}
```

## Tecnologías

- Express.js
- MongoDB + Mongoose
- JWT para autenticación
- bcryptjs para encriptación de contraseñas
