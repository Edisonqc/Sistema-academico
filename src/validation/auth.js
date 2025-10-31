// src/validation/auth.js
const Joi = require('joi');

const loginSchema = Joi.object({
    dni: Joi.string().length(8).pattern(/^\d+$/).required(),
    password: Joi.string().min(6).required()
});

const userSchema = Joi.object({
    dni: Joi.string().length(8).pattern(/^\d+$/).required(),
    nombre: Joi.string().min(2).max(100).required(),
    apellido_paterno: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().optional(),
    rol: Joi.string().valid('estudiante', 'docente', 'secretaria', 'administrativo', 'superadmin').required()
});