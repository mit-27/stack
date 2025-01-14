import { AsyncResult, Result } from "./results";
import { generateUuid } from "./uuids";
import { ReactPromise, pending, rejected, resolved } from "./promises";

export type ReadonlyStore<T> = {
  get(): T,
  onChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void },
  onceChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void },
};

export class Store<T> implements ReadonlyStore<T> {
  private readonly _callbacks: Map<string, ((value: T, oldValue: T | undefined) => void)> = new Map();

  constructor(
    private _value: T
  ) {}

  get(): T {
    return this._value;
  }

  set(value: T): void {
    const oldValue = this._value;
    this._value = value;
    this._callbacks.forEach((callback) => callback(value, oldValue));
  }

  update(updater: (value: T) => T): T {
    const value = updater(this._value);
    this.set(value);
    return value;
  }

  onChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void } {
    const uuid = generateUuid();
    this._callbacks.set(uuid, callback);
    return {
      unsubscribe: () => {
        this._callbacks.delete(uuid);
      },
    };
  }

  onceChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void } {
    const { unsubscribe } = this.onChange((...args) => {
      unsubscribe();
      callback(...args);
    });
    return { unsubscribe };
  }
}

export type ReadonlyAsyncStore<T> = {
  isAvailable(): boolean,
  get(): AsyncResult<T, unknown, void>,
  getOrWait(): ReactPromise<T>,
  onChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void },
  onceChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void },
};

export class AsyncStore<T> implements ReadonlyAsyncStore<T> {
  private _isAvailable: boolean;
  private _value: T | undefined = undefined;

  private _isRejected = false;
  private _rejectionError: unknown;
  private readonly _waitingRejectFunctions = new Map<string, ((error: unknown) => void)>();

  private readonly _callbacks: Map<string, ((value: T, oldValue: T | undefined) => void)> = new Map();

  private _updateCounter = 0;
  private _lastSuccessfulUpdate = -1;

  constructor(...args: [] | [T]) {
    if (args.length === 0) {
      this._isAvailable = false;
    } else {
      this._isAvailable = true;
      this._value = args[0];
    }
  }

  isAvailable(): boolean {
    return this._isAvailable;
  }

  isRejected(): boolean {
    return this._isRejected;
  }

  get() {
    if (this.isRejected()) {
      return AsyncResult.error(this._rejectionError);
    } else if (this.isAvailable()) {
      return AsyncResult.ok(this._value as T);
    } else {
      return AsyncResult.pending();
    }
  }

  getOrWait(): ReactPromise<T> {
    const uuid = generateUuid();
    if (this.isRejected()) {
      return rejected(this._rejectionError);
    } else if (this.isAvailable()) {
      return resolved(this._value as T);
    }
    const promise = new Promise<T>((resolve, reject) => {
      this.onceChange((value) => {
        resolve(value);
      });
      this._waitingRejectFunctions.set(uuid, reject);
    });
    const withFinally = promise.finally(() => {
      this._waitingRejectFunctions.delete(uuid);
    });
    return pending(withFinally);
  }

  _setIfLatest(result: Result<T>, curCounter: number) {
    if (curCounter > this._lastSuccessfulUpdate) {
      switch (result.status) {
        case "ok": {
          if (!this._isAvailable || this._isRejected || this._value !== result.data) {
            const oldValue = this._value;
            this._lastSuccessfulUpdate = curCounter;
            this._isAvailable = true;
            this._isRejected = false;
            this._value = result.data;
            this._rejectionError = undefined;
            this._callbacks.forEach((callback) => callback(result.data, oldValue));
            return true;
          }
          return false;
        }
        case "error": {
          this._lastSuccessfulUpdate = curCounter;
          this._isAvailable = false;
          this._isRejected = true;
          this._value = undefined;
          this._rejectionError = result.error;
          this._waitingRejectFunctions.forEach((reject) => reject(result.error));
          return true;
        }
      }
    }
    return false;
  }

  set(value: T): void {
    this._setIfLatest(Result.ok(value), ++this._updateCounter);
  }

  update(updater: (value: T | undefined) => T): T {
    const value = updater(this._value);
    this.set(value);
    return value;
  }

  async setAsync(promise: Promise<T>): Promise<boolean> {
    const curCounter = ++this._updateCounter;
    const result = await Result.fromPromise(promise);
    return this._setIfLatest(result, curCounter);
  }

  setUnavailable(): void {
    this._lastSuccessfulUpdate = ++this._updateCounter;
    this._isAvailable = false;
    this._isRejected = false;
    this._value = undefined;
    this._rejectionError = undefined;
  }

  setRejected(error: unknown): void {
    this._setIfLatest(Result.error(error), ++this._updateCounter);
  }

  map<U>(mapper: (value: T) => U): AsyncStore<U> {
    const store = new AsyncStore<U>();
    this.onChange((value) => {
      store.set(mapper(value));
    });
    return store;
  }

  onChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void } {
    const uuid = generateUuid();
    this._callbacks.set(uuid, callback);
    return {
      unsubscribe: () => {
        this._callbacks.delete(uuid);
      },
    };
  }

  onceChange(callback: (value: T, oldValue: T | undefined) => void): { unsubscribe: () => void } {
    const { unsubscribe } = this.onChange((...args) => {
      unsubscribe();
      callback(...args);
    });
    return { unsubscribe };
  }
}
