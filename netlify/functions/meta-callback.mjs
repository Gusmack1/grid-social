// GET /api/meta-callback — Facebook redirects here after user approves
// Exchanges code → short-lived token → long-lived token → stores in Netlify env
export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`<h1>Auth Failed</h1><p>${url.searchParams.get("error_description")}</p>`, 
      {headers: {"Content-Type": "text/html"}});
  }

  if (!code) {
    return new Response("<h1>No code received</h1>", {headers: {"Content-Type": "text/html"}});
  }

  const APP_ID = "1576303166762174";
  const APP_SECRET = Netlify.env.get("META_APP_SECRET");
  const REDIRECT = "https://gridsocial.co.uk/api/meta-callback";

  if (!APP_SECRET) {
    return new Response("<h1>Error: META_APP_SECRET not set in Netlify env</h1>", 
      {headers: {"Content-Type": "text/html"}});
  }

  try {
    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(`<h1>Token Error</h1><pre>${JSON.stringify(tokenData.error, null, 2)}</pre>`,
        {headers: {"Content-Type": "text/html"}});
    }

    const shortToken = tokenData.access_token;

    // Step 2: Exchange short-lived → long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
    );
    const longData = await longRes.json();

    if (longData.error) {
      return new Response(`<h1>Long-lived Token Error</h1><pre>${JSON.stringify(longData.error, null, 2)}</pre>`,
        {headers: {"Content-Type": "text/html"}});
    }

    const longToken = longData.access_token;
    const expiresIn = longData.expires_in || 5184000; // ~60 days

    // Step 3: Store in Netlify env via API
    const NETLIFY_PAT = Netlify.env.get("NETLIFY_PAT");
    const ACCOUNT_SLUG = "angus-mackay-u3bffxo";
    const SITE_ID = "108bd8de-94a4-4fda-917e-37af03242040";

    if (NETLIFY_PAT) {
      // Delete old var
      await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env/META_LONG_USER_TOKEN?site_id=${SITE_ID}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${NETLIFY_PAT}` }
      });

      // Create new var
      await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env?site_id=${SITE_ID}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NETLIFY_PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify([{
          key: "META_LONG_USER_TOKEN",
          scopes: ["builds", "functions", "runtime", "post_processing"],
          values: [{ value: longToken, context: "all" }]
        }])
      });

      // Also store expiry timestamp
      const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();
      await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env/META_TOKEN_EXPIRES?site_id=${SITE_ID}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${NETLIFY_PAT}` }
      });
      await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT_SLUG}/env?site_id=${SITE_ID}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NETLIFY_PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify([{
          key: "META_TOKEN_EXPIRES",
          scopes: ["builds", "functions", "runtime", "post_processing"],
          values: [{ value: expiryDate, context: "all" }]
        }])
      });

      // Trigger rebuild
      await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/builds`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${NETLIFY_PAT}` }
      });
    }

    const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString().split("T")[0];
    
    return new Response(`<!DOCTYPE html>
<html><head><title>Grid Social — Token Stored</title>
<style>body{font-family:system-ui;max-width:600px;margin:60px auto;padding:20px}
h1{color:#16a34a}.info{background:#f0fdf4;padding:20px;border-radius:8px;border:1px solid #bbf7d0}
code{background:#e5e7eb;padding:2px 6px;border-radius:4px}</style></head>
<body>
<h1>✅ Token stored successfully</h1>
<div class="info">
<p><strong>Token type:</strong> Long-lived User Token</p>
<p><strong>Expires:</strong> ${expiryDate}</p>
<p><strong>Stored as:</strong> <code>META_LONG_USER_TOKEN</code> in Netlify env</p>
<p><strong>Auto-refresh:</strong> Scheduled 7 days before expiry</p>
</div>
<p>You can close this tab. Everything is automated from here.</p>
</body></html>`, {headers: {"Content-Type": "text/html"}});

  } catch(e) {
    return new Response(`<h1>Error</h1><pre>${e.message}</pre>`, {headers: {"Content-Type": "text/html"}});
  }
};

export const config = { path: "/api/meta-callback" };
