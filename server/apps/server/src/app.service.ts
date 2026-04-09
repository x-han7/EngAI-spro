import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/shared';
import { ResponseService } from '@libs/shared';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) {}
  getHello() {
    const test = this.prisma.getTest();
    return this.response.success(test);
  }
}
