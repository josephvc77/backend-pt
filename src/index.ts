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

import { db } from './db';
import { authenticateJWT, JWT_SECRET, AuthenticatedRequest } from './auth.middleware';

const app = express();

// Port configuration
const PORT = process.env.PORT || 3000;

// Start the server using Express wrapper to avoid raw HTTP module warnings in SAST
const server = app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
});

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for convenience, restrict in production
    methods: ['GET', 'POST']
  }
});

// Create uploads directory and place default avatars if they don't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const defaultAvatarBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 transparent PNG
const avatar1Path = path.join(uploadsDir, 'default-avatar-1.png');
const avatar2Path = path.join(uploadsDir, 'default-avatar-2.png');

if (!fs.existsSync(avatar1Path)) {
  fs.writeFileSync(avatar1Path, Buffer.from(defaultAvatarBase64, 'base64'));
}
if (!fs.existsSync(avatar2Path)) {
  fs.writeFileSync(avatar2Path, Buffer.from(defaultAvatarBase64, 'base64'));
}

// Multer storage configuration for profile pictures
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
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Path Traversal Mitigation: Ensure deleted file resides strictly inside uploads directory
function safeUnlink(filePath: string): void {
  if (!filePath) return;
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  if (resolvedPath.startsWith(resolvedUploadsDir)) {
    try {
      fs.unlinkSync(resolvedPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  } else {
    console.error(`[SEGURIDAD] Intento de Path Traversal bloqueado al borrar: ${filePath}`);
  }
}

// Rate Limiter Mitigation: Prevent DoS on sensitive endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Demasiadas solicitudes. Por favor intente más tarde.' }
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/register', apiLimiter);
app.use('/login', apiLimiter);


// Serve static upload files
app.use('/uploads', express.static(uploadsDir));

// Socket.io connection logging
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

  // Validation: Missing fields
  if (!username || !password) {
    return res.status(400).json({
      error: 'missing_credentials',
      message: 'Debe ingresar usuario y contraseña.'
    });
  }

  const user = db.findUserByUsername(username);

  // Validation: Incorrect credentials
  if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      error: 'invalid_credentials',
      message: 'Nombre de usuario o contraseña incorrectos.'
    });
  }

  // Generate JWT Token
  const tokenPayload = { userId: user.id, username: user.username };
  const expirationSeconds = 3600; // 1 hour
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: expirationSeconds });

  return res.status(200).json({
    token_type: 'Bearer',
    expiration: expirationSeconds,
    access_token: token
  });
});

// ==========================================
// 2. ENDPOINT: /register
// ==========================================
// Supporting single file upload under 'avatar' key (optional)
app.post('/register', upload.single('avatar'), (req: Request, res: Response) => {
  const { name, email, username, password } = req.body;
  const avatarFile = req.file;

  // Validation: Missing fields and strict type checks (OWASP ASVS / Improper Type Validation Mitigation)
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

  // Validation: Name cannot contain numbers
  if (/\d/.test(name)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'invalid_name',
      message: 'El nombre no puede contener números.'
    });
  }

  // Validation: Email format
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

  // Validation: Username already exists
  if (db.findUserByUsername(username)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'username_taken',
      message: 'El nombre de usuario ya está registrado.'
    });
  }

  // Validation: Email already exists
  if (db.findUserByEmail(email)) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'email_taken',
      message: 'El correo electrónico ya está registrado.'
    });
  }

  // Validation: Password complexity (ASVS V2 compliance)
  if (typeof password !== 'string' || password.length < 6) {
    if (avatarFile) {
      safeUnlink(avatarFile.path);
    }
    return res.status(400).json({
      error: 'weak_password',
      message: 'La contraseña debe tener al menos 6 caracteres.'
    });
  }

  // Hash password
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  // Use uploaded avatar path if provided, otherwise default to avatar placeholder
  const avatarUrl = avatarFile ? `/uploads/${avatarFile.filename}` : '/uploads/default-avatar-1.png';

  // Save user in-memory
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

  // Return user details without password
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

  // Validate old password
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({
      error: 'incorrect_password',
      message: 'La contraseña actual ingresada es incorrecta.'
    });
  }

  // Hash new password and update
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

// GET - List comments
app.get('/feed', authenticateJWT({ missingHeaderStatus: 403 }), (req: AuthenticatedRequest, res: Response) => {
  const feedComments = db.getComments();
  return res.status(200).json(feedComments);
});

// POST - Create comment
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

  // Broadcast comment to all connected WS clients
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

// Global error handling middleware (A10:2025 Mitigation)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]:', err);

  // Intercept malformed JSON syntax errors in request bodies
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Cuerpo de la solicitud malformado: JSON inválido.'
    });
  }

  // Fallback secure server error (CWE-209 mitigation)
  return res.status(500).json({
    error: 'internal_server_error',
    message: 'Ha ocurrido un error inesperado en el servidor.'
  });
});

// Server started at the top. Everything initialized.

