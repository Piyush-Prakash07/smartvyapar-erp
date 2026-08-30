import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty({ message: 'Email address is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Verification OTP is required' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only numeric digits' })
  otp: string;
}
