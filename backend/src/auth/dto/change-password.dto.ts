import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  oldPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu mới phải có chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải có chữ số' })
  newPassword!: string;
}

