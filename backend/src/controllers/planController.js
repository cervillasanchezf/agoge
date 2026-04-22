const Plan = require('../models/Plan');

const TRAINING_POPULATE = {
  path: 'days.trainings',
  select: 'name exercises',
  populate: {
    path: 'exercises.exerciseId',
    select: 'name name_es primaryMuscles',
  },
};

// @desc    Obtener todos los planes del usuario
// @route   GET /api/plans
// @access  Private
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ userId: req.userId })
      .populate(TRAINING_POPULATE)
      .sort({ createdAt: -1 });

    res.json({ success: true, data: plans });
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

    res.json({ success: true, data: plan });
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
    const { name, weeks, startDate, days, measurementDay } = req.body;
    const effectiveStart = startDate ? new Date(startDate) : new Date();

    const plan = await Plan.create({
      userId: req.userId,
      name,
      weeks,
      startDate: effectiveStart,
      days: days || [],
      measurementDay: measurementDay ?? null,
      dayHistory: [{ effectiveFrom: effectiveStart, days: days || [] }],
      active: false,
    });

    const populated = await plan.populate(TRAINING_POPULATE);

    res.status(201).json({ success: true, data: populated });
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

    const fields = ['name', 'weeks', 'startDate', 'measurementDay'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        plan[field] = req.body[field];
      }
    });

    // If days change, update current config AND append a versioned snapshot
    if (req.body.days !== undefined) {
      plan.days = req.body.days;
      const effectiveFrom = plan.active ? new Date() : (plan.startDate || new Date());
      plan.dayHistory.push({ effectiveFrom, days: req.body.days });
    }

    await plan.save();
    const populated = await plan.populate(TRAINING_POPULATE);

    res.json({ success: true, data: populated });
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
    // Reset history to a single entry at the moment of activation
    plan.dayHistory = [{ effectiveFrom: plan.startDate, days: plan.days }];
    await plan.save();

    const populated = await plan.populate(TRAINING_POPULATE);

    res.json({ success: true, data: populated });
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

    res.json({ success: true, data: plan });
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
