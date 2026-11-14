import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RequestAdminPaymentCancellationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason!: string;
}

export class ReviewAdminPaymentCancellationDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ValidateIf(
    (value: ReviewAdminPaymentCancellationDto, note: unknown) =>
      value.decision === 'REJECT' || note !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;
}
