import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { PoiService } from './poi.service';
import { PoiSearchQuery, PoiSearchResult } from '../../shared/types/src/schemas/search.schema';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PoiSearchQueryDto, PoiSearchResultDto } from '@trip-planner/shared/dtos';

@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  @UsePipes(ZodValidationPipe)
  @ApiOperation({ summary: 'Search for Points of Interest (POI)' })
  @ApiQuery({ name: 'query', type: PoiSearchQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of Points of Interest matching the search criteria.',
    type: [PoiSearchResultDto]
  })
  @Get('poi-search')
  async poiSearch(@Query() query: PoiSearchQueryDto): Promise<PoiSearchResult[] | null> {
    return this.poiService.poiSearch(query as PoiSearchQuery);
  }
}
