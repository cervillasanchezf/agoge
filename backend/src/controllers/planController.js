const Plan = require('../models/Plan');

const TRAINING_POPULATE = {
  path: 'planWeeks.days.trainings',
  select: 'name exercises',
  populate: {
    path: 'exercises.exerciseId',
    select: 'name name_es primaryMuscles',
  },
};

// Calcula la semana activa (1-based) dado el startDate del plan y su duración total
function computeCurrentWeek(plan) {
  if (!plan.active || !plan.startDate) return null;
  const totalWeeks = plan.planWeeks.length;
  if (totalWeeks === 0) return null;
  const msElapsed = Date.now() - new Date(plan.startDate).getTime();
  const weekIndex = Math.floor(msElapsed / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(weekIndex + 1, totalWeeks));
}

// @desc    Obtener todos los planes del usuario
// @route   GET /api/plans
// @access  Private
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.userId })
      .populate(TRAINING_POPULATE)
      .sort({ createdAt: -1 });

    const data = plans.map((p) => {
      const obj = p.toObject();
      obj.weeks = p.planWeeks.length;
      obj.currentWeek = computeCurrentWeek(p);
      return obj;
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener planes', error: error.message });
  }
};

// @desc    Obtener un plan por ID
// @route   GET /api/plans/:id
// @access  Private
exports.getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId })
      .populate(TRAINING_POPULATE);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    const obj = plan.toObject();
    obj.weeks = plan.planWeeks.length;
    obj.currentWeek = computeCurrentWeek(plan);

    res.json({ success: true, data: obj });
  } catch (error) {
    console.error('Error al obtener plan:', error);
    res.status(500).json({ success: false, message: 'Error al obtener plan', error: error.message });
  }
};

// @desc    Crear un nuevo plan
// @route   POST /api/plans
// @access  Private
exports.createPlan = async (req, res) => {
  try {
    const { name, planWeeks, startDate, measurementDay } = req.body;
    const effectiveStart = startDate ? new Date(startDate) : new Date();

    const plan = await Plan.create({
      userId: req.userId,
      name,
      startDate: effectiveStart,
      planWeeks: planWeeks || [],
      measurementDay: measurementDay ?? null,
      active: false,
    });

    const populated = await plan.populate(TRAINING_POPULATE);
    const obj = populated.toObject();
    obj.weeks = plan.planWeeks.length;
    obj.currentWeek = null;

    res.status(201).json({ success: true, data: obj });
  } catch (error) {
    console.error('Error al crear plan:', error);
    res.status(500).json({ success: false, message: 'Error al crear plan', error: error.message });
  }
};

// @desc    Actualizar un plan (nombre, semanas, días)
// @route   PUT /api/plans/:id
// @access  Private
exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    const fields = ['name', 'startDate', 'measurementDay'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });

    if (req.body.planWeeks !== undefined) {
      plan.planWeeks = req.body.planWeeks;
    }

    await plan.save();
    const populated = await plan.populate(TRAINING_POPULATE);
    const obj = populated.toObject();
    obj.weeks = plan.planWeeks.length;
    obj.currentWeek = computeCurrentWeek(plan);

    res.json({ success: true, data: obj });
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar plan', error: error.message });
  }
};

// @desc    Activar un plan (desactiva el anterior activo)
// @route   PATCH /api/plans/:id/activate
// @access  Private
exports.activatePlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    // Desactivar cualquier plan activo del usuario
    await Plan.updateMany({ userId: req.userId, active: true }, { active: false });

    plan.active = true;
    plan.startDate = new Date();
    plan.endDate = null;
    await plan.save();

    const populated = await plan.populate(TRAINING_POPULATE);
    const obj = populated.toObject();
    obj.weeks = plan.planWeeks.length;
    obj.currentWeek = 1;

    res.json({ success: true, data: obj });
  } catch (error) {
    console.error('Error al activar plan:', error);
    res.status(500).json({ success: false, message: 'Error al activar plan', error: error.message });
  }
};

// @desc    Finalizar manualmente el plan activo
// @route   PATCH /api/plans/:id/finish
// @access  Private
exports.finishPlan = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, userId: req.userId });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    plan.active = false;
    plan.endDate = new Date();
    await plan.save();

    const populated = await plan.populate(TRAINING_POPULATE);
    const obj = populated.toObject();
    obj.weeks = plan.planWeeks.length;
    obj.currentWeek = null;

    res.json({ success: true, data: obj });
  } catch (error) {
    console.error('Error al finalizar plan:', error);
    res.status(500).json({ success: false, message: 'Error al finalizar plan', error: error.message });
  }
};

// @desc    Eliminar un plan
// @route   DELETE /api/plans/:id
// @access  Private
exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    res.json({ success: true, message: 'Plan eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar plan:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar plan', error: error.message });
  }
};
