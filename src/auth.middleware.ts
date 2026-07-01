import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from './types';

import crypto from 'crypto';
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateJWT = (options: { missingHeaderStatus: 400 | 403 }) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Verificar si la cabecera existe
    if (!authHeader) {
      console.warn(`[CONTROL DE ACCESO] Intento de acceso sin cabeceras en ruta: ${req.originalUrl} (IP: ${req.ip})`);
      return res.status(options.missingHeaderStatus).json({
        error: 'missing_headers',
        message: 'Acceso denegado: Cabecera de autorización no encontrada.'
      });
    }

    // Verificar la estructura de la cabecera: 'Bearer <token>'
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.warn(`[CONTROL DE ACCESO] Formato de cabecera inválido en ruta: ${req.originalUrl} (IP: ${req.ip})`);
      return res.status(401).json({
        error: 'invalid_headers',
        message: 'Formato de cabecera incorrecto. Debe utilizar el esquema Bearer.'
      });
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
      next();
    } catch (error) {
      console.warn(`[CONTROL DE ACCESO] Token inválido o alterado en ruta: ${req.originalUrl} (IP: ${req.ip})`);
      return res.status(401).json({
        error: 'invalid_token',
        message: 'El token de acceso no es válido o ha expirado.'
      });
    }
  };
};

