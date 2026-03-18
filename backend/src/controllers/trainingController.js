const Training = require('../models/Training');

// @desc    Obtener plantillas de entrenamiento del usuario
// @route   GET /api/trainings
// @access  Private
exports.getTrainings = async (req, res) => {
  try {
    const trainings = await Training.find({ userId: req.userId })
      .populate('exercises.exerciseId', 'name name_es category primaryMuscles images')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: trainings });
  } catch (error) {
    console.error('Error al obtener entrenamientos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener entrenamientos' });
  }
};

// @desc    Obtener una plantilla de entrenamiento por ID
// @route   GET /api/trainings/:id
// @access  Private
exports.getTrainingById = async (req, res) => {
  try {
    const training = await Training.findOne({ _id: req.params.id, userId: req.userId })
      .populate('exercises.exerciseId', 'name name_es category primaryMuscles secondaryMuscles equipment level images');

    if (!training) {
      return res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    }
    res.json({ success: true, data: training });
  } catch (error) {
    console.error('Error al obtener entrenamiento:', error);
    res.status(500).json({ success: false, message: 'Error al obtener entrenamiento' });
  }
};

// @desc    Crear plantilla de entrenamiento
// @route   POST /api/trainings
// @access  Private
exports.createTraining = async (req, res) => {
  try {
    const { name, exercises } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre es requerido' });
    }
    if (!exercises || exercises.length === 0) {
      return res.status(400).json({ success: false, message: 'Debes añadir al menos un ejercicio' });
    }

    const training = await Training.create({
      userId: req.userId,
      name: name.trim(),
      exercises,
    });

    const populated = await training.populate('exercises.exerciseId', 'name name_es category primaryMuscles images');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Error al crear entrenamiento:', error);
    res.status(500).json({ success: false, message: 'Error al crear entrenamiento' });
  }
};

// @desc    Actualizar plantilla de entrenamiento
// @route   PUT /api/trainings/:id
// @access  Private
exports.updateTraining = async (req, res) => {
  try {
    const training = await Training.findOne({ _id: req.params.id, userId: req.userId });
    if (!training) {
      return res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    }

    const { name, exercises } = req.body;
    if (name) training.name = name.trim();
    if (exercises) training.exercises = exercises;

    await training.save();
    const populated = await training.populate('exercises.exerciseId', 'name name_es category primaryMuscles images');

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Error al actualizar entrenamiento:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar entrenamiento' });
  }
};

// @desc    Eliminar plantilla de entrenamiento
// @route   DELETE /api/trainings/:id
// @access  Private
exports.deleteTraining = async (req, res) => {
  try {
    const training = await Training.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!training) {
      return res.status(404).json({ success: false, message: 'Entrenamiento no encontrado' });
    }
    res.json({ success: true, message: 'Entrenamiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar entrenamiento:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar entrenamiento' });
  }
};
