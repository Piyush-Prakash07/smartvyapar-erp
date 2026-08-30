import api from '../../lib/axios';
import type {
  LoginDto,
  RegisterDto,
  AuthResponse,
  UserProfileResponse,
  VerifyEmailDto,
  ResendOtpDto,
  VerifyEmailResponse,
} from './types';

export const loginUser = async (data: LoginDto): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/login', data);
  return res.data;
};

export const registerUser = async (data: RegisterDto): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>('/auth/register', data);
  return res.data;
};

export const verifyEmail = async (
  data: VerifyEmailDto,
): Promise<VerifyEmailResponse> => {
  const res = await api.post<VerifyEmailResponse>('/auth/verify-email', data);
  return res.data;
};

export const resendVerificationOtp = async (
  data: ResendOtpDto,
): Promise<VerifyEmailResponse> => {
  const res = await api.post<VerifyEmailResponse>(
    '/auth/resend-verification-otp',
    data,
  );
  return res.data;
};

export const logoutUser = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getMeProfile = async (): Promise<UserProfileResponse> => {
  const res = await api.get<UserProfileResponse>('/auth/me');
  return res.data;
};
