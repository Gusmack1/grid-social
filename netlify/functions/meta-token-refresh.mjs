// Scheduled: runs daily at 6am UTC, checks if token needs refresh
// Long-lived user tokens can be refreshed before they expire
export default async (req) => {
  const LONG_TOKEN = Netlify.env.get("META_LONG_USER_TOKEN");
  const EXPIRES = Netlify.env.get("META_TOKEN_EXPIRES");
  const APP_ID = "1576303166762174";
  const APP_SECRET = Netlify.env.get("META_APP_SECRET");
  const NETLIFY_PAT = Netlify.env.get("NETLIFY_PAT");

  if (!LONG_TOKEN || !EXPIRES) {
    console.log("No user token set — skipping refresh");
    return;
  }

  const expiryDate = new Date(EXPIRES);
  const now = new Date();
  const daysUntilExpiry = (expiryDate - now) / 86400000;

  console.log(`Token expires: ${EXPIRES} (${Math.round(daysUntilExpiry)} days)`);

  // Refresh if within 7 days of expiry
  if (daysUntilExpiry > 7) {
    console.log("Token still valid, no refresh needed");
    return;
  }

  console.log("Token expiring soon — refreshing...");

  if (!APP_SECRET) {
    console.log("ERROR: META_APP_SECRET not set");
    return;
  }

  try {
    // Refresh the long-lived token
    const r = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${LONG_TOKEN}`
    );
    const data = await r.json();

    if (data.error) {
      console.log(`Refresh failed: ${data.error.message}`);
      console.log("User needs to re-authorize at /api/meta-auth");
      return;
    }

    const newToken = data.access_token;
    const expiresIn = data.expires_in || 5184000;
    const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update Netlify env vars
    const ACCOUNT_SLUG = "angus-mackay-u3bffxo";
    const SITE_ID = "108bd8de-94a4-4fda-917e-37af03242040";

    // Update token
    await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env/META_LONG_USER_TOKEN?site_id=${SITE_ID}`, {
      method: "DELETE", headers: {"Authorization": `Bearer ${NETLIFY_PAT}`}
    });
    await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env?site_id=${SITE_ID}`, {
      method: "POST",
      headers: {"Authorization": `Bearer ${NETLIFY_PAT}`, "Content-Type": "application/json"},
      body: JSON.stringify([{
        key: "META_LONG_USER_TOKEN",
        scopes: ["builds", "functions", "runtime", "post_processing"],
        values: [{value: newToken, context: "all"}]
      }])
    });

    // Update expiry
    await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env/META_TOKEN_EXPIRES?site_id=${SITE_ID}`, {
      method: "DELETE", headers: {"Authorization": `Bearer ${NETLIFY_PAT}`}
    });
    await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env?site_id=${SITE_ID}`, {
      method: "POST",
      headers: {"Authorization": `Bearer ${NETLIFY_PAT}`, "Content-Type": "application/json"},
      body: JSON.stringify([{
        key: "META_TOKEN_EXPIRES",
        scopes: ["builds", "functions", "runtime", "post_processing"],
        values: [{value: newExpiry, context: "all"}]
      }])
    });

    // Trigger rebuild
    await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/builds`, {
      method: "POST", headers: {"Authorization": `Bearer ${NETLIFY_PAT}`}
    });

    console.log(`✅ Token refreshed. New expiry: ${newExpiry}`);
  } catch(e) {
    console.log(`Refresh error: ${e.message}`);
  }
};

export const config = {
  schedule: "0 6 * * *"
};
