import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { TimezoneService } from './timezone.service';
import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { TimezoneRequestDto, TimezoneResponseDto } from '@trip-planner/shared/dtos';
import { randomUUID } from 'crypto';


@Controller('timezone')
export class TimezoneController {
  constructor(private readonly timezoneService: TimezoneService) {}

  @UsePipes(ZodValidationPipe)
  @ApiOperation({ summary: 'Get timezone from coordinates'})
  @ApiQuery({ name: 'query', type: TimezoneRequestDto})
  @ApiResponse({
    status: 200,
    description: 'Returns the timezone for the given coordinates',
    type: [TimezoneResponseDto]
  })
  @Get('coords')
  async getTimezoneFromCoords(
    @Query() query: TimezoneRequestDto
  ): Promise<TimezoneResponseDto> {
    query.requestId = randomUUID();
    return this.timezoneService.getTimezoneByCoordinates(query);
  }
}
