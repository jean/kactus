import { shell } from './app-shell'
import { Account, Provider } from '../models/account'
import { fatalError } from './fatal-error'
import { getOAuthAuthorizationURL, requestOAuthToken, fetchUser } from './api'
import { uuid } from './uuid'

interface IOAuthState {
  readonly provider: Provider
  readonly state: string
  readonly endpoint: string
  readonly clientId: string
  readonly clientSecret: string
  readonly resolve: (account: Account) => void
  readonly reject: (error: Error) => void
}

let oauthState: IOAuthState | null = null

/**
 * Ask the user to auth with the given endpoint. This will open their browser.
 *
 * @param endpoint - The endpoint to auth against.
 *
 * Returns a {Promise} which will resolve when the OAuth flow as been completed.
 * Note that the promise may not complete if the user doesn't complete the OAuth
 * flow.
 */
export function askUserToOAuth(
  provider: Provider,
  endpoint: string,
  clientId: string,
  clientSecret: string
) {
  // Disable the lint warning since we're storing the `resolve` and `reject`
  // functions.
  // tslint:disable-next-line:promise-must-complete
  return new Promise<Account>((resolve, reject) => {
    oauthState = {
      provider,
      state: uuid(),
      endpoint,
      clientId,
      clientSecret,
      resolve,
      reject,
    }

    const oauthURL = getOAuthAuthorizationURL(
      endpoint,
      clientId,
      oauthState.state
    )
    shell.openExternal(oauthURL)
  })
}

/**
 * Request the authenticated using, using the code given to us by the OAuth
 * callback.
 */
export async function requestAuthenticatedUser(
  code: string
): Promise<Account | null> {
  if (!oauthState) {
    return fatalError(
      '`askUserToOAuth` must be called before requesting an authenticated user.'
    )
  }

  const token = await requestOAuthToken(
    oauthState.provider,
    oauthState.endpoint,
    oauthState.clientId,
    oauthState.clientSecret,
    oauthState.state,
    code
  )
  if (token) {
    return fetchUser(oauthState.provider, oauthState.endpoint, token)
  } else {
    return null
  }
}

/**
 * Resolve the current OAuth request with the given account.
 *
 * Note that this can only be called after `askUserToOAuth` has been called and
 * must only be called once.
 */
export function resolveOAuthRequest(account: Account) {
  if (!oauthState) {
    fatalError(
      '`askUserToOAuth` must be called before resolving an auth request.'
    )
    return
  }

  oauthState.resolve(account)

  oauthState = null
}

/**
 * Reject the current OAuth request with the given error.
 *
 * Note that this can only be called after `askUserToOAuth` has been called and
 * must only be called once.
 */
export function rejectOAuthRequest(error: Error) {
  if (!oauthState) {
    fatalError(
      '`askUserToOAuth` must be called before rejecting an auth request.'
    )
    return
  }

  oauthState.reject(error)

  oauthState = null
}
