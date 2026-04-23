const TrainingSession = require('../models/TrainingSession');
const Training = require('../models/Training');

// @desc    Obtener la última sesión de una plantilla (para pre-cargar valores)
// @route   GET /api/training-sessions/last/:trainingId
// @access  Private
exports.getLastSession = async (req, res) => {
  try {
    const session = await TrainingSession.findOne({
      userId: req.userId,
      trainingId: req.params.trainingId,
    })
      .populate('exercises.exerciseId', 'name name_es category primaryMuscles images')
      .sort({ date: -1 });

    res.json({ success: true, data: session || null });
  } catch (error) {
    console.error('Error al obtener última sesión:', error);
    res.status(500).json({ success: false, message: 'Error al obtener última sesión' });
  }
};

// @desc    Obtener historial de sesiones de una plantilla
// @route   GET /api/training-sessions/history/:trainingId
// @access  Private
exports.getSessionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await TrainingSession.countDocuments({
      userId: req.userId,
      trainingId: req.params.trainingId,
    });

    const sessions = await TrainingSession.find({
      userId: req.userId,
      trainingId: req.params.trainingId,
    })
      .populate('exercises.exerciseId', 'name name_es primaryMuscles')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
};

// @desc    Guardar una sesión completada
// @route   POST /api/training-sessions
// @access  Private
exports.createSession = async (req, res) => {
  try {
    const { trainingId, exercises, notes, date, duration } = req.body;

    // Verificar que la plantilla pertenece al usuario
    const training = await Training.findOne({ _id: trainingId, userId: req.userId });
    if (!training) {
      return res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    }

    const session = await TrainingSession.create({
      userId: req.userId,
      trainingId,
      exercises,
      notes: notes || '',
      date: date ? new Date(date) : new Date(),
      duration: duration || 0,
    });

    const populated = await session.populate('exercises.exerciseId', 'name name_es category primaryMuscles images');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Error al guardar sesión:', error);
    res.status(500).json({ success: false, message: 'Error al guardar sesión' });
  }
};

// @desc    Obtener todo el historial del usuario (todas las plantillas)
// @route   GET /api/training-sessions/all
// @access  Private
exports.getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId: req.userId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const total = await TrainingSession.countDocuments(filter);

    const sessions = await TrainingSession.find(filter)
      .populate('trainingId', 'name')
      .populate('exercises.exerciseId', 'name name_es primaryMuscles')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
};

// @desc    Actualizar la fecha de una sesión
// @route   PUT /api/training-sessions/:id
// @access  Private
exports.updateSession = async (req, res) => {
  try {
    const { date, exercises, notes, duration } = req.body;
    const session = await TrainingSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }
    if (date !== undefined)      session.date      = new Date(date);
    if (exercises !== undefined) session.exercises = exercises;
    if (notes !== undefined)     session.notes     = notes;
    if (duration !== undefined)  session.duration  = duration;
    await session.save();
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error al actualizar sesión:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar sesión' });
  }
};

// @desc    Eliminar una sesión
// @desc    Obtener el máximo 1RM histórico por ejercicio para una rutina (todas las sesiones)
// @route   GET /api/training-sessions/exercise-maxes/:trainingId
// @access  Private
exports.getExerciseMaxes = async (req, res) => {
  try {
    const sessions = await TrainingSession.find({
      userId: req.userId,
      trainingId: req.params.trainingId,
    }).select('exercises');

    // exerciseId (string) → { max1RM, weight, reps }
    const exMap = {};
    sessions.forEach((session) => {
      session.exercises.forEach((ex) => {
        const id = String(ex.exerciseId);
        (ex.sets || []).forEach((s) => {
          if (!s.completed) return;
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps) || 0;
          if (w === 0) return;
          const orm = w * (1 + r / 30); // Epley
          if (!exMap[id] || orm > exMap[id].max1RM) {
            exMap[id] = { max1RM: orm, weight: w, reps: r };
          }
        });
      });
    });

    res.json({ success: true, data: exMap });
  } catch (error) {
    console.error('Error al obtener máximos por ejercicio:', error);
    res.status(500).json({ success: false, message: 'Error al obtener máximos por ejercicio' });
  }
};

// @route   DELETE /api/training-sessions/:id
// @access  Private
exports.deleteSession = async (req, res) => {
  try {
    const session = await TrainingSession.findOne({ _id: req.params.id, userId: req.userId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
    }
    await session.deleteOne();
    res.json({ success: true, message: 'Sesión eliminada' });
  } catch (error) {
    console.error('Error al eliminar sesión:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar sesión' });
  }
};
