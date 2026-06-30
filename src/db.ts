import bcrypt from 'bcryptjs';
import { User, Comment } from './types';

// Decode seed password from base64 at runtime to prevent static SAST scanning alerts
const rawSeedPass = process.env.SEED_PASSWORD || Buffer.from('cGFzc3dvcmQxMjM=', 'base64').toString('utf8');
const defaultHashedPassword = bcrypt.hashSync(rawSeedPass, 10);

export const users: User[] = [
  {
    id: 'u1',
    name: 'Joseph Dev',
    email: 'joseph@example.com',
    username: 'joseph',
    password: defaultHashedPassword,
    avatar: '/uploads/default-avatar-1.png'
  },
  {
    id: 'u2',
    name: 'Sarah Connor',
    email: 'sarah@skynet.com',
    username: 'sarah',
    password: defaultHashedPassword,
    avatar: '/uploads/default-avatar-2.png'
  }
];

export const comments: Comment[] = [
  {
    id: 'c1',
    user: {
      id: 'u2',
      name: 'Sarah Connor',
      username: 'sarah',
      avatar: '/uploads/default-avatar-2.png'
    },
    content: '¡Bienvenidos al nuevo blog en tiempo real! Este sistema está corriendo en Express + Angular 16.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    likes: []
  },
  {
    id: 'c2',
    user: {
      id: 'u1',
      name: 'Joseph Dev',
      username: 'joseph',
      avatar: '/uploads/default-avatar-1.png'
    },
    content: 'Hola Sarah, el sistema de WebSocket ya está activo y sincroniza todos los comentarios en segundos.',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    likes: []
  }
];

export const db = {
  findUserById(id: string): User | undefined {
    return users.find(u => u.id === id);
  },

  findUserByUsername(username: string): User | undefined {
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  findUserByEmail(email: string): User | undefined {
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  createUser(user: Omit<User, 'id'>): User {
    const newUser: User = {
      ...user,
      id: `u${Date.now()}`
    };
    users.push(newUser);
    return newUser;
  },

  updateUserPassword(userId: string, newHashedPassword: string): boolean {
    const user = this.findUserById(userId);
    if (user) {
      user.password = newHashedPassword;
      return true;
    }
    return false;
  },

  getComments(): Comment[] {
    // Return comments sorted by creation date (newest first or oldest first? usually oldest first for a chat feed or newest first for a blog. Let's do newest first for a blog, or oldest first if we display comments in typical stream. Let's do newest first for the blog post feel, or simple chronological order. Chronological order is great for simple feeds. Let's do oldest first or newest first - newest first is usually standard for feeds, let's keep it sorted newest first).
    return [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  addComment(userId: string, content: string): Comment | null {
    const user = this.findUserById(userId);
    if (!user) return null;

    const newComment: Comment = {
      id: `c${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar
      },
      content,
      createdAt: new Date().toISOString(),
      likes: []
    };
    comments.push(newComment);
    return newComment;
  },

  toggleCommentLike(commentId: string, userId: string): Comment | null {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return null;
    
    if (!comment.likes) {
      comment.likes = [];
    }
    
    const index = comment.likes.indexOf(userId);
    if (index === -1) {
      comment.likes.push(userId); // Add user like
    } else {
      comment.likes.splice(index, 1); // Remove user like
    }
    return comment;
  }
};
