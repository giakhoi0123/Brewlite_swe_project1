import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã khôi phục không được để trống' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải có chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu phải có chữ số' })
  newPassword!: string;
}

