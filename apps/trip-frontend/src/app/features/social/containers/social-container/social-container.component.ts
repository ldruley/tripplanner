import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { TabsModule } from 'primeng/tabs';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';

import { SocialService } from '../../services/social.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { FriendshipWithUsers, UserSearchResult } from '@trip-planner/types';
import { ButtonComponent } from '../../../shared/components';

@Component({
  selector: 'app-social-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    ConfirmPopupModule,
    ButtonComponent,
    InputTextModule,
  ],
  templateUrl: './social-container.component.html',
  styleUrls: ['./social-container.component.css'],
  providers: [MessageService, ConfirmationService],
})
export class SocialContainerComponent implements OnInit, OnDestroy {
  private readonly socialService = inject(SocialService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly confirmationService = inject(ConfirmationService);

  // State signals
  friends = signal<FriendshipWithUsers[]>([]);
  pendingRequests = signal<FriendshipWithUsers[]>([]);
  sentRequests = signal<FriendshipWithUsers[]>([]);
  searchResults = signal<UserSearchResult[]>([]);

  // Loading states
  loadingFriends = signal(false);
  loadingPendingRequests = signal(false);
  loadingSentRequests = signal(false);
  loadingSearch = signal(false);

  // Search state
  searchQuery = signal('');

  // Active tab index
  activeTabIndex = signal(0);

  // RxJS subjects for search debouncing
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.loadFriends();
    this.loadPendingRequests();
    this.loadSentRequests();
    this.setupSearchDebounce();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce() {
    this.searchSubject
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only emit when the value actually changes
        takeUntil(this.destroy$) // Clean up subscription on component destroy
      )
      .subscribe(query => {        
        if (query.length >= 2) {
          this.loadingSearch.set(true);
          this.socialService.searchUsers(query).subscribe({
            next: results => {
              this.searchResults.set(results);
              this.loadingSearch.set(false);
            },
            error: error => {
              console.error('Error searching users:', error);
              this.toastService.showError('Failed to search users');
              this.loadingSearch.set(false);
            }
          });
        } else {
          // Clear results for short queries
          this.searchResults.set([]);
          this.loadingSearch.set(false);
        }
      });
  }

  loadFriends() {
    this.loadingFriends.set(true);
    this.socialService.getFriends().subscribe({
      next: friends => {
        this.friends.set(friends);
        this.loadingFriends.set(false);
      },
      error: error => {
        console.error('Error loading friends:', error);
        this.toastService.showError('Failed to load friends');
        this.loadingFriends.set(false);
      },
    });
  }

  loadPendingRequests() {
    this.loadingPendingRequests.set(true);
    this.socialService.getPendingRequests().subscribe({
      next: requests => {
        this.pendingRequests.set(requests);
        this.loadingPendingRequests.set(false);
      },
      error: error => {
        console.error('Error loading pending requests:', error);
        this.toastService.showError('Failed to load pending requests');
        this.loadingPendingRequests.set(false);
      },
    });
  }

  loadSentRequests() {
    this.loadingSentRequests.set(true);
    this.socialService.getSentRequests().subscribe({
      next: requests => {
        this.sentRequests.set(requests);
        this.loadingSentRequests.set(false);
      },
      error: error => {
        console.error('Error loading sent requests:', error);
        this.toastService.showError('Failed to load sent requests');
        this.loadingSentRequests.set(false);
      },
    });
  }

  onSearchQueryChange(query: string) {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  onSendFriendRequest(userId: string) {
    this.socialService.sendFriendRequest(userId).subscribe({
      next: result => {
        if (result.success) {
          this.toastService.showSuccess('Friend request sent successfully');
          // Update the search results to reflect the new status
          this.searchSubject.next(this.searchQuery());
          // Reload sent requests to show the new request
          this.loadSentRequests();
        } else {
          this.toastService.showError(result.error || 'Failed to send friend request');
        }
      },
      error: error => {
        console.error('Error sending friend request:', error);
        this.toastService.showError('Failed to send friend request');
      },
    });
  }

  onAcceptFriendRequest(requestId: string) {
    this.socialService.acceptFriendRequest(requestId).subscribe({
      next: result => {
        if (result.success) {
          this.toastService.showSuccess('Friend request accepted');
          // Reload all relevant data
          this.loadFriends();
          this.loadPendingRequests();
        } else {
          this.toastService.showError(result.error || 'Failed to accept friend request');
        }
      },
      error: error => {
        console.error('Error accepting friend request:', error);
        this.toastService.showError('Failed to accept friend request');
      },
    });
  }

  onDeclineFriendRequest(requestId: string) {
    this.socialService.declineFriendRequest(requestId).subscribe({
      next: result => {
        if (result.success) {
          this.toastService.showSuccess('Friend request declined');
          // Reload pending requests
          this.loadPendingRequests();
        } else {
          this.toastService.showError(result.error || 'Failed to decline friend request');
        }
      },
      error: error => {
        console.error('Error declining friend request:', error);
        this.toastService.showError('Failed to decline friend request');
      },
    });
  }

  onRemoveFriend(friendId: string) {
    this.socialService.removeFriend(friendId).subscribe({
      next: result => {
        if (result.success) {
          this.toastService.showSuccess('Friend removed successfully');
          // Reload friends list
          this.loadFriends();
        } else {
          this.toastService.showError(result.error || 'Failed to remove friend');
        }
      },
      error: error => {
        console.error('Error removing friend:', error);
        this.toastService.showError('Failed to remove friend');
      },
    });
  }

  confirmRemoveFriend(friendId: string, event: Event) {
    this.confirmationService.confirm({
      target: event.target ?? undefined,
      message: 'Are you sure you want to remove this friend?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.onRemoveFriend(friendId);
      },
    });
  }

  onTabChange(event: any) {
    this.activeTabIndex.set(event.index);
  }

  getUserDisplayName(user: any): string {
    const profile = user.profile || user.sender?.profile || user.receiver?.profile;
    return (
      profile?.displayName ||
      (profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : null) ||
      user.email ||
      user.sender?.email ||
      user.receiver?.email ||
      'Unknown User'
    );
  }

  getUserEmail(user: any): string {
    return user.email || user.sender?.email || user.receiver?.email || '';
  }

  getUserAvatarUrl(user: any): string | null {
    const profile = user.profile || user.sender?.profile || user.receiver?.profile;
    return profile?.avatarUrl || null;
  }

  getFriendId(friendship: FriendshipWithUsers): string {
    // Get the friend's ID (the user who is not the current user)
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('No current user found');
    }
    return friendship.senderId === currentUser.id ? friendship.receiverId : friendship.senderId;
  }
}
