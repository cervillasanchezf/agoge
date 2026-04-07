const Measurement = require('../models/Measurement');

// @desc    Obtener todas las medidas del usuario autenticado
// @route   GET /api/measurements
// @access  Private
exports.getMeasurements = async (req, res) => {
  try {
    const measurements = await Measurement.find({ userId: req.userId })
      .sort({ date: -1 });

    res.json({ success: true, data: measurements });
  } catch (error) {
    console.error('Error al obtener medidas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener medidas', error: error.message });
  }
};

// @desc    Obtener una medida por ID
// @route   GET /api/measurements/:id
// @access  Private
exports.getMeasurementById = async (req, res) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, userId: req.userId });

    if (!measurement) {
      return res.status(404).json({ success: false, message: 'Medida no encontrada' });
    }

    res.json({ success: true, data: measurement });
  } catch (error) {
    console.error('Error al obtener medida:', error);
    res.status(500).json({ success: false, message: 'Error al obtener medida', error: error.message });
  }
};

// @desc    Crear una nueva medida
// @route   POST /api/measurements
// @access  Private
exports.createMeasurement = async (req, res) => {
  try {
    const {
      date, photos, notes,
      peso, cintura, cuello, hombro, pecho,
      bicepsIzq, bicepsDer, antebrazoIzq, antebrazoDer,
      abdomen, cadera, musloIzq, musloDer, gemeloIzq, gemeloDer,
    } = req.body;

    const measurement = await Measurement.create({
      userId: req.userId,
      date: date || Date.now(),
      photos: photos || [],
      notes: notes || '',
      peso, cintura, cuello, hombro, pecho,
      bicepsIzq, bicepsDer, antebrazoIzq, antebrazoDer,
      abdomen, cadera, musloIzq, musloDer, gemeloIzq, gemeloDer,
    });

    res.status(201).json({ success: true, data: measurement });
  } catch (error) {
    console.error('Error al crear medida:', error);
    res.status(500).json({ success: false, message: 'Error al crear medida', error: error.message });
  }
};

// @desc    Actualizar una medida
// @route   PUT /api/measurements/:id
// @access  Private
exports.updateMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, userId: req.userId });

    if (!measurement) {
      return res.status(404).json({ success: false, message: 'Medida no encontrada' });
    }

    const fields = [
      'date', 'photos', 'notes',
      'peso', 'cintura', 'cuello', 'hombro', 'pecho',
      'bicepsIzq', 'bicepsDer', 'antebrazoIzq', 'antebrazoDer',
      'abdomen', 'cadera', 'musloIzq', 'musloDer', 'gemeloIzq', 'gemeloDer',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        measurement[field] = req.body[field];
      }
    });

    await measurement.save();

    res.json({ success: true, data: measurement });
  } catch (error) {
    console.error('Error al actualizar medida:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar medida', error: error.message });
  }
};

// @desc    Eliminar una medida
// @route   DELETE /api/measurements/:id
// @access  Private
exports.deleteMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findOneAndDelete({ _id: req.params.id, userId: req.userId });

    if (!measurement) {
      return res.status(404).json({ success: false, message: 'Medida no encontrada' });
    }

    res.json({ success: true, message: 'Medida eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar medida:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar medida', error: error.message });
  }
};
