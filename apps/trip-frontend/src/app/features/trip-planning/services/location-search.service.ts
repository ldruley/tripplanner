import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Location } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationSearchService {
  constructor() { }

  searchLocations(query: string): Observable<Location[]> {
    console.log(`Mock LocationSearchService: Searching for "${query}"`);

    // Simulate API call returning an array of Location objects
    const mockResults: Location[] = [
      {
        id: crypto.randomUUID(),
        name: `Mock Result for "${query}" 1 (e.g., Coffee Shop)`,
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        country: 'USA',
        postalCode: '90210',
        latitude: 34.0522,
        longitude: -118.2437,
        description: 'A popular local coffee spot.',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        name: `Mock Result for "${query}" 2 (e.g., Park)`,
        address: '456 Oak Ave',
        city: 'Anytown',
        state: 'CA',
        country: 'USA',
        postalCode: '90210',
        latitude: 34.0530,
        longitude: -118.2445,
        description: 'A beautiful green space.',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        name: `Point of Interest for "${query}" 3`,
        latitude: 34.0540,
        longitude: -118.2455,
        // Some fields might be undefined for POIs
        address: undefined,
        city: 'Anytown',
        state: 'CA',
        country: 'USA',
        postalCode: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    // Return only if query has some length, or adjust as needed
    return of(query && query.trim().length > 0 ? mockResults : []).pipe(delay(500));
  }
}
