import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UpdateUserSettings } from '@trip-planner/types';


@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  getUserSettings(): Observable<UpdateUserSettings> {
    return this.http.get<UpdateUserSettings>('/api/user-settings');
  }

  updateUserSettings(dto: UpdateUserSettings): Observable<void> {
    return this.http.put<void>('/api/user-settings', dto);
  }
}
