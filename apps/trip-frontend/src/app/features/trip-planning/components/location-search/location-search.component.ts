import { Component, output, signal, WritableSignal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationSearchService } from '../../services/location-search.service';
import { Location } from '../../models/location.model';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap, tap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-location-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-search.component.html',
  styleUrls: ['./location-search.component.css']
})
export class LocationSearchComponent implements OnDestroy{
  readonly locationSelected = output<Location>();
  searchQuery: WritableSignal<string> = signal('');
  searchResults: WritableSignal<Location[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  hasAttemptedSearch: WritableSignal<boolean> = signal(false);

  private searchTrigger = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private locationSearchService: LocationSearchService) {
    this.searchTrigger.pipe(
      tap(() => {
        this.isLoading.set(true);
        this.searchResults.set([]);
      }),
      switchMap(query =>
        this.locationSearchService.searchLocations(query).pipe(
          catchError(error => {
            console.error('Search failed:', error);
            return EMPTY;
          })
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.searchResults.set(results);
      this.isLoading.set(false);
    });
  }

  performSearch(): void {
    const currentQuery = this.searchQuery().trim();
    this.hasAttemptedSearch.set(true);
    if (currentQuery.length > 0) {
      this.searchTrigger.next(currentQuery);
    } else {
      this.searchResults.set([]); // Clear results if query is empty
    }
  }

  selectLocation(location: Location): void {
    this.locationSelected.emit(location);
    this.searchResults.set([]);
    this.searchQuery.set('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
