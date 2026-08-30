export type Role =
  | 'OWNER'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'CASHIER'
  | 'INVENTORY_MANAGER'
  | 'SALES_MANAGER';

export interface Company {
  id: string;
  name: string;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface CompanyWithRole extends Company {
  role: Role;
}

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName: string;
}

export interface LoginDto {
  identifier: string; // Email or Mobile Number
  password: string;
}

export interface RegisterDto {
  companyName: string;
  fullName: string;
  password: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
}

export interface AuthResponse {
  user: User;
  company?: CompanyWithRole;
  companies: CompanyWithRole[];
  accessToken: string;
  message?: string;
}

export interface UserProfileResponse {
  user: User & { status: string };
  companies: CompanyWithRole[];
}
