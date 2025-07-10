import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  FriendshipListResponse,
  UserSearchResponse,
  FriendshipResponse,
  CreateFriendshipRequest,
  UpdateFriendshipRequest,
  FriendshipWithUsers,
  UserSearchResult,
} from '@trip-planner/types';

import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SocialService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.backendApiUrl}/friendship`;

  getFriends(): Observable<FriendshipWithUsers[]> {
    return this.http.get<FriendshipListResponse>(`${this.apiUrl}/friends`).pipe(
      map(response => response.data),
      catchError(this.handleError<FriendshipWithUsers[]>('getFriends', []))
    );
  }

  getPendingRequests(): Observable<FriendshipWithUsers[]> {
    return this.http.get<FriendshipListResponse>(`${this.apiUrl}/requests/pending`).pipe(
      map(response => response.data),
      catchError(this.handleError<FriendshipWithUsers[]>('getPendingRequests', []))
    );
  }

  getSentRequests(): Observable<FriendshipWithUsers[]> {
    return this.http.get<FriendshipListResponse>(`${this.apiUrl}/requests/sent`).pipe(
      map(response => response.data),
      catchError(this.handleError<FriendshipWithUsers[]>('getSentRequests', []))
    );
  }

  searchUsers(query: string, limit = 10): Observable<UserSearchResult[]> {
    if (query.length < 2) {
      return of([]);
    }
    
    return this.http
      .get<UserSearchResponse>(`${this.apiUrl}/search`, {
        params: { q: query, limit: limit.toString() },
      })
      .pipe(
        map(response => response.data),
        catchError(this.handleError<UserSearchResult[]>('searchUsers', []))
      );
  }

  sendFriendRequest(receiverId: string): Observable<{ success: boolean; error?: string }> {
    const request: CreateFriendshipRequest = { receiverId };
    return this.http.post<FriendshipResponse>(`${this.apiUrl}/request`, request).pipe(
      map(() => ({ success: true })),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.message || 'Failed to send friend request';
        return of({ success: false, error: message });
      })
    );
  }

  acceptFriendRequest(requestId: string): Observable<{ success: boolean; error?: string }> {
    const request: UpdateFriendshipRequest = { status: 'ACCEPTED' };
    return this.http
      .put<FriendshipResponse>(`${this.apiUrl}/request/${requestId}/respond`, request)
      .pipe(
        map(() => ({ success: true })),
        catchError((error: HttpErrorResponse) => {
          const message = error.error?.message || 'Failed to accept friend request';
          return of({ success: false, error: message });
        })
      );
  }

  declineFriendRequest(requestId: string): Observable<{ success: boolean; error?: string }> {
    const request: UpdateFriendshipRequest = { status: 'DECLINED' };
    return this.http
      .put<FriendshipResponse>(`${this.apiUrl}/request/${requestId}/respond`, request)
      .pipe(
        map(() => ({ success: true })),
        catchError((error: HttpErrorResponse) => {
          const message = error.error?.message || 'Failed to decline friend request';
          return of({ success: false, error: message });
        })
      );
  }

  removeFriend(friendId: string): Observable<{ success: boolean; error?: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/remove/${friendId}`).pipe(
      map(() => ({ success: true })),
      catchError((error: HttpErrorResponse) => {
        const message = error.error?.message || 'Failed to remove friend';
        return of({ success: false, error: message });
      })
    );
  }

  getFriendshipStatus(userId: string): Observable<string> {
    return this.http
      .get<{ success: boolean; status: string; message: string }>(`${this.apiUrl}/status/${userId}`)
      .pipe(
        map(response => response.status),
        catchError(this.handleError<string>('getFriendshipStatus', 'NONE'))
      );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: HttpErrorResponse): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }
}