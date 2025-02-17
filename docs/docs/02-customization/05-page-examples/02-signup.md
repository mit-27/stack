---
sidebar_position: 1
---

# Sign Up

## Custom page with `SignUp` component

```tsx
'use client';
import { SignUp } from "@stackframe/stack";

export default function DefaultSignUp() {
  // optionally redirect to some other page if the user is already signed in
  // const user = useUser();
  // if (user) { redirect to some other page }
  return <SignUp fullPage />;
}
```

You can also use `useUser` at the beginning of the sign in page to check if wether the user is already signed in and redirect them to some other page if they are. 

## Other useful components

`CredentialSignUp`: A component that contains a form for signing in with email and password.

`OAuthGroup`: A list of available OAuth provider sign-up buttons components. The available provider list is fetched from the server.

`OAuthButton`: A single OAuth sign-up button.

## Custom OAuth Sign Up

OAuth sign-in and sign-up shares the same function. Check out the [Sign In example](/docs/customization/page-examples/signin#custom-oauth-sign-in) for more information.

## Custom Credential Sign Up

```tsx
'use client';

import { useStackApp } from "@stackframe/stack";
import { useState } from "react";

export default function CustomCredentialSignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const app = useStackApp();

  const onSubmit = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }
    // this will redirect to app.urls.afterSignUp if successful, you can customize it in the StackServerApp constructor
    const errorCode = await app.signUpWithCredential({ email, password });
    // It is better to handle each error code separately, but we will just show the error code directly for simplicity here
    if (errorCode) {
      setError(errorCode.message);
    }
  };
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); } }>
      {error}
      <input type='email' placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type='password' placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type='submit'>Sign Up</button>
    </form>
  );
}
```

## Custom Magic Link Sign Up

Magic link sign-in and sign-up shares the same function. Check out the [Sign In example](/docs/customization/page-examples/signin#custom-magic-link-sign-in) for more information.