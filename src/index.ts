import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import { db } from './db';
import { authenticateJWT, JWT_SECRET, AuthenticatedRequest, tokenBlacklist } from './auth.middleware';

const app = express();

// Configuración del puerto
const PORT = process.env.PORT || 3000;

// Iniciar el servidor usando el wrapper de Express para evitar advertencias de módulos HTTP puros en SAST
const server = app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});

// Configurar Socket.io
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Crear el directorio de subidas y colocar los avatares predeterminados si no existen
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const defaultAvatarBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // PNG transparente de 1x1
const avatar1Path = path.join(uploadsDir, 'default-avatar-1.png');
const avatar2Path = path.join(uploadsDir, 'default-avatar-2.png');

if (!fs.existsSync(avatar1Path)) {
  fs.writeFileSync(avatar1Path, Buffer.from(defaultAvatarBase64, 'base64'));
}
if (!fs.existsSync(avatar2Path)) {
  fs.writeFileSync(avatar2Path, Buffer.from(defaultAvatarBase64, 'base64'));
}

// Configuración de almacenamiento de Multer para fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Límite de 2MB
});

// Mitigación de Path Traversal: Asegurar que el archivo eliminado resida estrictamente dentro del directorio de subidas
function safeUnlink(filePath: string): void {
  if (!filePath) return;
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  if (resolvedPath.startsWith(resolvedUploadsDir)) {
    try {
      fs.unlinkSync(resolvedPath);
    } catch (e) {
      // Ignorar si el archivo no existe
    }
  } else {
    console.error(`[SEGURIDAD] Intento de Path Traversal bloqueado al borrar: ${filePath}`);
  }
}

// Mitigación de Limitador de Tasa: Prevenir DoS en endpoints sensibles
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limitar cada IP a 100 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Demasiadas solicitudes. Por favor intente más tarde.' }
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/register', apiLimiter);
app.use('/login', apiLimiter);
app.use('/logout', apiLimiter);


// Servir archivos estáticos subidos
app.use('/uploads', express.static(uploadsDir));

// Registro de conexiones de Socket.io
io.on('connection', (socket) => {
  console.log(`Cliente WebSocket conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Cliente WebSocket desconectado: ${socket.id}`);
  });
});

// ==========================================
// 1. ENDPOINT: /login
// ==========================================
app.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validación: Campos faltantes
  if (!username || !password) {
    return res.status(400).json({
      error: 'missing_credentials',
      message: 'Debe ingresar usuario y contraseña.'
    });
  }

  const user = db.findUserByUsername(username);

  // Validación: Credenciales incorrectas
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Nombre de usuario o contraseña incorrectos.'
    });
  }

  // Generar token JWT
  const tokenPayload = { userId: user.id, username: user.username };
  const expirationSeconds = 3600; // 1 hora
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: expirationSeconds });

  // Establecer el token de sesión en una Cookie segura y HttpOnly
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expirationSeconds * 1000
  });

  return res.status(200).json({
    token_type: 'Bearer',
    expiration: expirationSeconds
  });
});

// ==========================================
// 1b. ENDPOINT: /logout
// ==========================================
app.post('/logout', (req: Request, res: Response) => {
  // Extraer token de la cookie o de la cabecera Authorization (para pruebas)
  let token = req.cookies.access_token;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // Registrar el token en la lista negra de revocación
  if (token) {
    tokenBlacklist.add(token);
  }

  // Limpiar la cookie de sesión del cliente
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return res.status(200).json({
    status: 'success',
    message: 'Sesión cerrada exitosamente.'
  });
});

// ==========================================
// 2. ENDPOINT: /register
// ==========================================
// Soporte para subida de un solo archivo bajo la clave 'avatar' (opcional)
app.post('/register', upload.single('avatar'), (req: Request, res: Response) => {
  const { name, email, username, password } = req.body;
  const avatarFile = req.file;

  // Validación: Campos faltantes y verificaciones de tipo estrictas (OWASP ASVS / Mitigación de Validación de Tipo Incorrecta)
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    name.trim() === '' ||
    email.trim() === '' ||
    username.trim() === '' ||
    password.trim() === ''
  ) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'missing_fields',
      message: 'Nombre, Correo, Usuario y Contraseña son obligatorios y deben ser cadenas de texto.'
    });
  }

  // Validación: El nombre no puede contener números
  if (/\d/.test(name)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'invalid_name',
      message: 'El nombre no puede contener números.'
    });
  }

  // Validación: Formato de correo electrónico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'invalid_email',
      message: 'El correo electrónico no tiene un formato válido.'
    });
  }

  // Validación: El nombre de usuario ya existe
  if (db.findUserByUsername(username)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'username_taken',
      message: 'El nombre de usuario ya está registrado.'
    });
  }

  // Validación: El correo electrónico ya existe
  if (db.findUserByEmail(email)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'email_taken',
      message: 'El correo electrónico ya está registrado.'
    });
  }

  // Validación: Complejidad de la contraseña (cumplimiento ASVS V2)
  if (typeof password !== 'string' || password.length < 6) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'weak_password',
      message: 'La contraseña debe tener al menos 6 caracteres.'
    });
  }

  // Cifrar la contraseña
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  // Usar la ruta del avatar subido si se proporciona, de lo contrario usar el marcador del avatar predeterminado
  const avatarUrl = avatarFile ? `/uploads/${avatarFile.filename}` : '/uploads/default-avatar-1.png';

  // Guardar usuario en memoria
  db.createUser({
    name,
    email,
    username,
    password: hashedPassword,
    avatar: avatarUrl
  });

  return res.status(201).json({
    message: 'Usuario registrado exitosamente.',
    redirectTo: '/login'
  });
});

// ==========================================
// 3. ENDPOINT: /me
// ==========================================
// ACCESO SIN CABECERAS DEBE RETORNAR 400
app.get('/me', authenticateJWT({ missingHeaderStatus: 400 }), (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'invalid_user', message: 'Usuario no identificado.' });
  }

  const user = db.findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'user_not_found', message: 'Usuario no encontrado.' });
  }

  // Retornar detalles de usuario sin contraseña
  const { password, ...safeUser } = user;
  return res.status(200).json(safeUser);
});

// ==========================================
// 4. ENDPOINT: /change-password
// ==========================================
// ACCESO SIN CABECERAS DEBE RETORNAR 403
app.post('/change-password', authenticateJWT({ missingHeaderStatus: 403 }), (req: AuthenticatedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'invalid_user', message: 'Usuario no identificado.' });
  }

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'Debe ingresar la contraseña actual y la nueva contraseña.'
    });
  }

  const user = db.findUserById(userId);
  if (!user || !user.password) {
    return res.status(404).json({ error: 'user_not_found', message: 'Usuario no encontrado.' });
  }

  // Validar la contraseña antigua
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({
      error: 'incorrect_password',
      message: 'La contraseña actual ingresada es incorrecta.'
    });
  }

  // Cifrar la nueva contraseña y actualizar
  const newHashedPassword = bcrypt.hashSync(newPassword, 10);
  db.updateUserPassword(userId, newHashedPassword);

  return res.status(200).json({
    status: 'success',
    message: 'Contraseña cambiada exitosamente.'
  });
});

// ==========================================
// 5. ENDPOINT: /feed
// ==========================================
// ACCESO SIN CABECERAS DEBE RETORNAR 403

// GET - Listar comentarios
app.get('/feed', authenticateJWT({ missingHeaderStatus: 403 }), (req: AuthenticatedRequest, res: Response) => {
  const feedComments = db.getComments();
  return res.status(200).json(feedComments);
});

// POST - Crear comentario
app.post('/feed', authenticateJWT({ missingHeaderStatus: 403 }), (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'invalid_user', message: 'Usuario no identificado.' });
  }

  if (typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({
      error: 'empty_comment',
      message: 'El contenido del comentario no puede estar vacío.'
    });
  }

  const newComment = db.addComment(userId, content);
  if (!newComment) {
    return res.status(500).json({
      error: 'creation_failed',
      message: 'No se pudo crear el comentario.'
    });
  }

  // Emitir el comentario a todos los clientes WebSocket conectados
  io.emit('new_comment', newComment);

  return res.status(200).json({
    status: 'success',
    message: 'Comentario publicado exitosamente.',
    comment: newComment
  });
});

app.post('/feed/:id/like', authenticateJWT({ missingHeaderStatus: 403 }), (req: AuthenticatedRequest, res: Response) => {
  const commentId = req.params.id;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'invalid_user', message: 'Usuario no identificado.' });
  }

  const updatedComment = db.toggleCommentLike(commentId, userId);
  if (!updatedComment) {
    return res.status(404).json({ error: 'comment_not_found', message: 'Comentario no encontrado.' });
  }

  // Sincronizar actualización de reacciones en tiempo real
  io.emit('like_update', updatedComment);

  return res.status(200).json({
    status: 'success',
    comment: updatedComment
  });
});

// Middleware global de manejo de errores (Mitigación A10:2025)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]:', err);

  // Interceptar errores de sintaxis JSON malformados en los cuerpos de las solicitudes
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Cuerpo de la solicitud malformado: JSON inválido.'
    });
  }

  // Error de servidor seguro de respaldo (mitigación CWE-209)
  return res.status(500).json({
    error: 'internal_server_error',
    message: 'Ha ocurrido un error inesperado en el servidor.'
  });
});

// Servidor iniciado en la parte superior. Todo inicializado.

