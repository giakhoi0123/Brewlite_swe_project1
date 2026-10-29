import { Module } from '@nestjs/common';
import { NodemailerMailService } from './mail.service';
import { MAIL_SERVICE } from './mail.types';

@Module({
  providers: [
    {
      provide: MAIL_SERVICE,
      useClass: NodemailerMailService,
    },
    NodemailerMailService,
  ],
  exports: [MAIL_SERVICE, NodemailerMailService],
})
export class MailModule {}

