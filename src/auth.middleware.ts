import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from './types';

import crypto from 'crypto';
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Lista negra para tokens revocados tras el cierre de sesión (mitigación de reutilización de token)
export const tokenBlacklist = new Set<string>();

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateJWT = (options: { missingHeaderStatus: 400 | 403 }) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let token = req.cookies?.access_token;
    let authHeader = req.headers.authorization;

    // Si no está en las cookies y hay cabecera, verificar que tenga el formato Bearer
    if (!token && authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        console.warn(`[CONTROL DE ACCESO] Formato de cabecera inválido en ruta: ${req.originalUrl} (IP: ${req.ip})`);
        return res.status(401).json({
          error: 'invalid_headers',
          message: 'Formato de cabecera incorrecto. Debe utilizar el esquema Bearer.'
        });
      }
      token = parts[1];
    }

    // Si no se encuentra el token de ninguna forma
    if (!token) {
      console.warn(`[CONTROL DE ACCESO] Intento de acceso sin autenticación en ruta: ${req.originalUrl} (IP: ${req.ip})`);
      return res.status(options.missingHeaderStatus).json({
        error: 'missing_headers',
        message: 'Acceso denegado: Cabecera de autorización o cookie de sesión no encontrada.'
      });
    }

    // Validar si el token fue revocado (está en la lista negra tras logout)
    if (tokenBlacklist.has(token)) {
      console.warn(`[CONTROL DE ACCESO] Intento de acceso con token revocado en ruta: ${req.originalUrl} (IP: ${req.ip})`);
      return res.status(401).json({
        error: 'token_revoked',
        message: 'El token ha sido revocado (sesión cerrada).'
      });
    }

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
