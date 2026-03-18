const Exercise = require('../models/Exercise');

// @desc    Obtener ejercicios con búsqueda y filtros paginados
// @route   GET /api/exercises
// @access  Private
exports.getExercises = async (req, res) => {
  try {
    const {
      search,
      category,
      level,
      equipment,
      primaryMuscle,
      mechanic,
      force,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Búsqueda por nombre (inglés o castellano)
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { name_es: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filtros exactos
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (equipment) filter.equipment = equipment;
    if (mechanic) filter.mechanic = mechanic;
    if (force) filter.force = force;
    if (primaryMuscle) filter.primaryMuscles = primaryMuscle;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Exercise.countDocuments(filter);

    const exercises = await Exercise.find(filter)
      .select('externalId name name_es category level equipment mechanic force primaryMuscles secondaryMuscles images')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: exercises,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error al obtener ejercicios:', error);
    res.status(500).json({ success: false, message: 'Error al obtener ejercicios' });
  }
};

// @desc    Obtener un ejercicio por ID (incluye instrucciones)
// @route   GET /api/exercises/:id
// @access  Private
exports.getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Ejercicio no encontrado' });
    }
    res.json({ success: true, data: exercise });
  } catch (error) {
    console.error('Error al obtener ejercicio:', error);
    res.status(500).json({ success: false, message: 'Error al obtener ejercicio' });
  }
};

// @desc    Obtener valores únicos de filtros para poblar los selectores del frontend
// @route   GET /api/exercises/filters
// @access  Private
exports.getFilters = async (req, res) => {
  try {
    const [categories, levels, equipments, mechanics, forces, muscles] = await Promise.all([
      Exercise.distinct('category'),
      Exercise.distinct('level'),
      Exercise.distinct('equipment'),
      Exercise.distinct('mechanic'),
      Exercise.distinct('force'),
      Exercise.distinct('primaryMuscles'),
    ]);

    res.json({
      success: true,
      data: {
        categories: categories.filter(Boolean).sort(),
        levels: levels.filter(Boolean).sort(),
        equipments: equipments.filter(Boolean).sort(),
        mechanics: mechanics.filter(Boolean).sort(),
        forces: forces.filter(Boolean).sort(),
        muscles: muscles.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error('Error al obtener filtros:', error);
    res.status(500).json({ success: false, message: 'Error al obtener filtros' });
  }
};
