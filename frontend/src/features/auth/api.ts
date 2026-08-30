import api from '../../lib/axios';
import type {
  LoginDto,
  RegisterDto,
  AuthResponse,
  UserProfileResponse,
} from './types';

export const loginUser = async (data: LoginDto): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/login', data);
  return res.data;
};

export const registerUser = async (data: RegisterDto): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/register', data);
  return res.data;
};

export const logoutUser = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getMeProfile = async (): Promise<UserProfileResponse> => {
  const res = await api.get<UserProfileResponse>('/auth/me');
  return res.data;
};
