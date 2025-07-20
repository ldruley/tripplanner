import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LocationFacade } from './location.facade';
import { LocationQueryService } from './services/location-query.service';
import { LocationCommandService } from './services/location-command.service';
import { Location, SearchMode, UserFavoriteLocation, CreateUserFavoriteLocation } from '@trip-planner/types';

describe('LocationFacade', () => {
  let facade: LocationFacade;
  let mockQueryService: jasmine.SpyObj<LocationQueryService>;
  let mockCommandService: jasmine.SpyObj<LocationCommandService>;

  const mockLocation: Location = {
    id: 'test-location-id',
    name: 'Test Location',
    address: '123 Test St',
    latitude: 40.7128,
    longitude: -74.0060,
    countryCode: 'US'
  };

  const mockFavorite: UserFavoriteLocation = {
    id: 'test-favorite-id',
    name: 'My Favorite Place',
    locationId: 'test-location-id',
    location: mockLocation,
    userId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    const queryServiceSpy = jasmine.createSpyObj('LocationQueryService', ['execute', 'clearFavoritesCache']);
    const commandServiceSpy = jasmine.createSpyObj('LocationCommandService', ['execute']);

    TestBed.configureTestingModule({
      providers: [
        LocationFacade,
        { provide: LocationQueryService, useValue: queryServiceSpy },
        { provide: LocationCommandService, useValue: commandServiceSpy }
      ]
    });

    facade = TestBed.inject(LocationFacade);
    mockQueryService = TestBed.inject(LocationQueryService) as jasmine.SpyObj<LocationQueryService>;
    mockCommandService = TestBed.inject(LocationCommandService) as jasmine.SpyObj<LocationCommandService>;
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('Search Operations', () => {
    it('should search locations with specified mode', () => {
      const searchQuery = 'paris';
      const searchMode: SearchMode = 'place';
      const expectedResults = [mockLocation];

      mockQueryService.execute.and.returnValue(of(expectedResults));

      facade.searchLocations(searchQuery, searchMode).subscribe(result => {
        expect(result).toEqual(expectedResults);
      });

      expect(mockQueryService.execute).toHaveBeenCalledWith({
        type: '[Location] Search Locations',
        payload: { query: searchQuery, mode: searchMode }
      });
    });

    it('should search by address', () => {
      const searchQuery = '123 Main St';
      const expectedResults = [mockLocation];

      mockQueryService.execute.and.returnValue(of(expectedResults));

      facade.searchByAddress(searchQuery).subscribe(result => {
        expect(result).toEqual(expectedResults);
      });

      expect(mockQueryService.execute).toHaveBeenCalledWith({
        type: '[Location] Search By Address',
        payload: { query: searchQuery }
      });
    });

    it('should search by place', () => {
      const searchQuery = 'Central Park';
      const expectedResults = [mockLocation];

      mockQueryService.execute.and.returnValue(of(expectedResults));

      facade.searchByPlace(searchQuery).subscribe(result => {
        expect(result).toEqual(expectedResults);
      });

      expect(mockQueryService.execute).toHaveBeenCalledWith({
        type: '[Location] Search By Place',
        payload: { query: searchQuery }
      });
    });
  });

  describe('Favorite Operations', () => {
    it('should get user favorites', () => {
      const expectedFavorites = [mockFavorite];

      mockQueryService.execute.and.returnValue(of(expectedFavorites));

      facade.getUserFavorites().subscribe(result => {
        expect(result).toEqual(expectedFavorites);
      });

      expect(mockQueryService.execute).toHaveBeenCalledWith({
        type: '[Location] Get User Favorites'
      });
    });

    it('should get favorite by id', () => {
      const favoriteId = 'test-favorite-id';

      mockQueryService.execute.and.returnValue(of(mockFavorite));

      facade.getFavoriteById(favoriteId).subscribe(result => {
        expect(result).toEqual(mockFavorite);
      });

      expect(mockQueryService.execute).toHaveBeenCalledWith({
        type: '[Location] Get Favorite By Id',
        payload: { favoriteId }
      });
    });

    it('should create a favorite', () => {
      const createData: CreateUserFavoriteLocation = {
        name: 'New Favorite',
        locationId: 'test-location-id'
      };

      mockCommandService.execute.and.returnValue(of(mockFavorite));

      facade.createFavorite(createData).subscribe(result => {
        expect(result).toEqual(mockFavorite);
      });

      expect(mockCommandService.execute).toHaveBeenCalledWith({
        type: '[Location] Create Favorite',
        payload: createData
      });
    });

    it('should update a favorite', () => {
      const favoriteId = 'test-favorite-id';
      const updates = { name: 'Updated Favorite Name' };

      mockCommandService.execute.and.returnValue(of(mockFavorite));

      facade.updateFavorite(favoriteId, updates).subscribe(result => {
        expect(result).toEqual(mockFavorite);
      });

      expect(mockCommandService.execute).toHaveBeenCalledWith({
        type: '[Location] Update Favorite',
        payload: { favoriteId, updates }
      });
    });

    it('should delete a favorite', () => {
      const favoriteId = 'test-favorite-id';

      mockCommandService.execute.and.returnValue(of(undefined));

      facade.deleteFavorite(favoriteId).subscribe(result => {
        expect(result).toBeUndefined();
      });

      expect(mockCommandService.execute).toHaveBeenCalledWith({
        type: '[Location] Delete Favorite',
        payload: { favoriteId }
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear favorites cache', () => {
      facade.clearFavoritesCache();

      expect(mockQueryService.clearFavoritesCache).toHaveBeenCalled();
    });
  });
});