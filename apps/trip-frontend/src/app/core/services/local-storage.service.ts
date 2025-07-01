import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private signals = new Map<string, WritableSignal<any>>();
  private subjects = new Map<string, BehaviorSubject<any>>();

  /**
   * Retrieves an item from local storage and parses it as JSON.
   * @param key
   * @return The parsed value from local storage or null if the key does not exist or parsing fails.
   */
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    try {
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /**
   * Stores an item in local storage as a JSON string and updates reactive stores.
   * @param key - The local storage key to set.
   * @param value - The value to store, which will be serialized to JSON.
   */
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
    this.updateReactiveStores(key, value);
  }

  /**
   * Updates an item in local storage and updates reactive stores.
   * If the value is null, it removes the item from local storage.
   * @param key - The local storage key to update.
   * @param value - The new value to store, or null to remove the item.
   */
  remove(key: string): void {
    localStorage.removeItem(key);
    this.updateReactiveStores(key, null);
  }

  /**
   * Clears all items from local storage and updates reactive stores.
   * This will remove all keys and set their reactive stores to null.
   */
  clear(): void {
    localStorage.clear();
    this.signals.forEach((_, key) => this.updateReactiveStores(key, null));
  }

  /**
   * Reactive access via RxJS Observable
   * @param key - The local storage key to watch
   * @return An Observable that emits the current value of the key in local storage.
   * */
  watch<T>(key: string): Observable<T | null> {
    if (!this.subjects.has(key)) {
      this.subjects.set(key, new BehaviorSubject(this.get<T>(key)));
    }
    return this.subjects.get(key)!.asObservable();
  }

  /**
   * Reactive access via Angular Signal
   * @param key - The local storage key to watch
   * @return A Signal that emits the current value of the key in local storage.
   * */
  signal<T>(key: string): Signal<T | null> {
    if (!this.signals.has(key)) {
      this.signals.set(key, signal(this.get<T>(key)));
    }
    return this.signals.get(key)!;
  }

  private updateReactiveStores<T>(key: string, value: T | null): void {
    this.subjects.get(key)?.next(value);
    this.signals.get(key)?.set(value);
  }
}
