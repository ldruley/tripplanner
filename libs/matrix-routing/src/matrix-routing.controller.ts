import { MatrixRoutingService } from './matrix-routing.service';
import { Controller, Get, Logger, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { MatrixQueryDto } from '@trip-planner/shared/dtos';
import { MatrixQuery } from '@trip-planner/types';

@Controller('matrix-routing')
export class MatrixRoutingController {
  constructor(private readonly matrixRoutingService: MatrixRoutingService) {}

  @UsePipes(ZodValidationPipe)
  @Get('route')
  async getMatrixRoute(@Query() query: MatrixQueryDto) {
    Logger.log('MatrixRoutingController.getMatrixRoute', query);
    return this.matrixRoutingService.getMatrixRouting(query as MatrixQuery);
  }
}
