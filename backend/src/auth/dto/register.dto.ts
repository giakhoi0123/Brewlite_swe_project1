import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải có chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu phải có chữ số' })
  password!: string;
}
