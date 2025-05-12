import { Auth } from 'aws-amplify';

/* ---------- Fetch profile helpers ---------- */
export async function getGoogleProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function getFacebookProfile(accessToken) {
  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,picture.type(large)&access_token=${accessToken}`,
  );
  return res.json();
}

/* ---------- Push token & profile into Cognito ---------- */
export async function signInToCognito(provider, token, expiresIn, profile) {
  const expires_at = Date.now() + expiresIn * 1000;

  await Auth.federatedSignIn(
    provider,                        // 'google' or 'facebook'
    { token, expires_at },
    {
      email:       profile.email,
      name:        profile.name,
      given_name:  profile.given_name || profile.first_name,
      family_name: profile.family_name || profile.last_name,
      picture:     profile.picture?.data?.url || profile.picture,
    },
  );
}
