import { IsNotEmpty, IsString } from 'class-validator';

export class RedeemRewardDto {
  @IsString({ message: 'Mã phần thưởng không hợp lệ' })
  @IsNotEmpty({ message: 'Mã phần thưởng không được để trống' })
  rewardId!: string;
}

