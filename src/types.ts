export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string; // Opcional para poder eliminarlo antes de enviarlo al cliente
  avatar: string;
}

export interface Comment {
  id: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  content: string;
  createdAt: string;
  likes?: string[];
}

export interface JWTPayload {
  userId: string;
  username: string;
}
