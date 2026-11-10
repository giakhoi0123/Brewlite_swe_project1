import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class ReviewAdminPaymentDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ValidateIf((value: ReviewAdminPaymentDto) => value.decision === 'REJECT')
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;
}

export class AdminPaymentQueryDto {
  @IsOptional()
  @IsIn(['PROCESSING', 'PAID', 'PAYMENT_FAILED'])
  status?: 'PROCESSING' | 'PAID' | 'PAYMENT_FAILED';
}
