export type { Profile } from '@/shared/types/database';

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
}

export interface SignInInput {
  email: string;
  password: string;
}
