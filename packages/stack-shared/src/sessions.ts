import { unsubscribe } from "diagnostics_channel";
import { StackAssertionError } from "./utils/errors";
import { ReadonlyStore, Store } from "./utils/stores";

export class AccessToken {
  constructor(
    public readonly token: string,
  ) {}

}

export class RefreshToken {
  constructor(
    public readonly token: string,
  ) {}
}

/**
 * A session represents a user's session, which may or may not be valid. It may contain an access token, a refresh token, or both.
 * 
 * A session never changes which user or session it belongs to, but the tokens may change over time.
 */
export class Session {
  /**
  * Each session has a session key that depends on the tokens inside. If the session has a refresh token, the session key depends only on the refresh token. If the session does not have a refresh token, the session key depends only on the access token.
  * 
  * Multiple Session objects may have the same session key, which implies that they represent the same session by the same user. Furthermore, a session's key never changes over the lifetime of a session object.
  * 
  * This makes session keys useful for caching and indexing sessions.
  */
  public readonly sessionKey: string;

  /**
   * An access token that is not known to be invalid (ie. may be valid, but may have expired).
   */
  private _accessToken: Store<AccessToken | null>;
  private readonly _refreshToken: RefreshToken | null;

  /**
   * Whether the session as a whole is known to be invalid. Used as a cache to avoid making multiple requests to the server (sessions never go back to being valid after being invalidated).
   * 
   * Applies to both the access token and the refresh token (it is possible for the access token to be invalid but the refresh token to be valid, in which case the session is still valid).
   */
  private _knownToBeInvalid = new Store<boolean>(false);

  private _refreshPromise: Promise<AccessToken | null> | null = null;

  constructor(private readonly _options: {
    refreshAccessTokenCallback(refreshToken: RefreshToken): Promise<AccessToken | null>,
    refreshToken: string | null,
    accessToken?: string | null,
  }) {
    this._accessToken = new Store(_options.accessToken ? new AccessToken(_options.accessToken) : null);
    this._refreshToken = _options.refreshToken ? new RefreshToken(_options.refreshToken) : null;
    this.sessionKey = Session.calculateSessionKey({ accessToken: _options.accessToken ?? null, refreshToken: _options.refreshToken });
  }

  static calculateSessionKey(ofTokens: { refreshToken: string | null, accessToken?: string | null }): string {
    if (ofTokens.refreshToken) {
      return `refresh-${ofTokens.refreshToken}`;
    } else if (ofTokens.accessToken) {
      return `access-${ofTokens.accessToken}`;
    } else {
      return "not-logged-in";
    }
  }

  invalidate() {
    this._accessToken.set(null);
    this._knownToBeInvalid.set(true);
  }

  onInvalidate(callback: () => void): { unsubscribe: () => void } {
    return this._knownToBeInvalid.onChange(() => callback());
  }

  async getPotentiallyExpiredTokens(): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken | null } | null> {
    const accessToken = await this._getPotentiallyExpiredAccessToken();
    return accessToken ? { accessToken, refreshToken: this._refreshToken } : null;
  }

  async getNewlyFetchedTokens(): Promise<{ accessToken: AccessToken, refreshToken: RefreshToken | null } | null> {
    const accessToken = await this._getNewlyFetchedAccessToken();
    return accessToken ? { accessToken, refreshToken: this._refreshToken } : null;
  }

  markAccessTokenExpired(accessToken: AccessToken) {
    if (this._accessToken.get() === accessToken) {
      this._accessToken.set(null);
    }
  }

  /**
   * Note that a callback invocation with `null` does not mean the session has been invalidated; the access token may just have expired. Use `onInvalidate` to detect invalidation.
   */
  onAccessTokenChange(callback: (newAccessToken: AccessToken | null) => void): { unsubscribe: () => void } {
    return this._accessToken.onChange(callback);
  }

  /**
   * @returns An access token (cached if possible), or null if the session either does not represent a user or the session is invalid. 
   */
  private async _getPotentiallyExpiredAccessToken(): Promise<AccessToken | null> {
    const oldAccessToken = this._accessToken.get();
    if (oldAccessToken) return oldAccessToken;
    if (!this._refreshToken) return null;
    if (this._knownToBeInvalid.get()) return null;

    // refresh access token
    if (!this._refreshPromise) {
      this._refreshAndSetRefreshPromise(this._refreshToken);
    }
    return await this._refreshPromise;
  }

  /**
   * You should prefer `getPotentiallyExpiredAccessToken` in almost all cases.
   * 
   * @returns A newly fetched access token (never read from cache), or null if the session either does not represent a user or the session is invalid. 
   */
  private async _getNewlyFetchedAccessToken(): Promise<AccessToken | null> {
    if (!this._refreshToken) return null;
    if (this._knownToBeInvalid.get()) return null;

    this._refreshAndSetRefreshPromise(this._refreshToken);
    return await this._refreshPromise;
  }

  private _refreshAndSetRefreshPromise(refreshToken: RefreshToken) {
    let refreshPromise: Promise<AccessToken | null> = this._options.refreshAccessTokenCallback(refreshToken).then((accessToken) => {
      if (refreshPromise === this._refreshPromise) {
        this._refreshPromise = null;
        this._accessToken.set(accessToken);
        if (!accessToken) {
          this.invalidate();
        }
      }
      return accessToken;
    });
    this._refreshPromise = refreshPromise;
  }
}