export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string; // Optional so we can delete it before sending to the client
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
}

export interface JWTPayload {
  userId: string;
  username: string;
}
