const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const exerciseRoutes = require('./routes/exercises');
const trainingRoutes = require('./routes/trainings');
const trainingSessionRoutes = require('./routes/trainingSessions');
const measurementRoutes = require('./routes/measurements');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar a la base de datos
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/training-sessions', trainingSessionRoutes);
app.use('/api/measurements', measurementRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API de Agoge funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
