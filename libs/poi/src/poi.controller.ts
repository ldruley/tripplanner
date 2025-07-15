import { Controller, Get, Query } from '@nestjs/common';
import { PoiService } from './poi.service';
import { PoiSearchQuery, Location } from '@trip-planner/types';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PoiSearchQueryDto, LocationDto } from '@trip-planner/shared/dtos';

@Controller('poi')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  @ApiOperation({ summary: 'Search for Points of Interest (POI)' })
  @ApiQuery({ name: 'query', type: PoiSearchQueryDto })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of Points of Interest matching the search criteria.',
    type: [LocationDto],
  })
  @Get('poi-search')
  async poiSearch(@Query() query: PoiSearchQueryDto): Promise<Location[]> {
    return this.poiService.poiSearch(query as PoiSearchQuery);
  }
}
