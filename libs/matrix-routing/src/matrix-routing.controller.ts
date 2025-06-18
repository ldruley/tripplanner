import { MatrixRoutingService } from './matrix-routing.service';
import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { MatrixQueryDto } from '../../shared/types/src/schemas/matrix.schema';


@Controller('matrix-routing')
export class MatrixRoutingController {
  constructor(private readonly matrixRoutingService: MatrixRoutingService) {}

  @UsePipes(ZodValidationPipe)
  @Get('route')
  async getMatrixRoute(@Query() query: MatrixQueryDto) {
    return this.matrixRoutingService.getMatrixRouting(query);
  }
}
