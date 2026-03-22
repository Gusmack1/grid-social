// One-time: configures Meta app domains and OAuth redirect URI
// GET /api/meta-setup — run once, then delete this function
export default async (req) => {
  const APP_ID = "1576303166762174";
  const APP_SECRET = Netlify.env.get("META_APP_SECRET");
  
  if (!APP_SECRET) {
    return new Response(JSON.stringify({error: "META_APP_SECRET not set"}), {status: 500});
  }

  // Get app access token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=client_credentials`
  );
  const tokenData = await tokenRes.json();
  
  if (tokenData.error) {
    return new Response(JSON.stringify({error: "App token failed", detail: tokenData.error}), {status: 500});
  }

  const appToken = tokenData.access_token;

  // Update app settings: add domain and OAuth redirect URI
  const updateRes = await fetch(`https://graph.facebook.com/v21.0/${APP_ID}`, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      access_token: appToken,
      app_domains: JSON.stringify(["gridsocial.co.uk"]),
      website_url: "https://gridsocial.co.uk/",
    }).toString()
  });
  const updateData = await updateRes.json();

  // Add OAuth redirect URI via the product settings
  // For Facebook Login, we need to update the Valid OAuth Redirect URIs
  const loginRes = await fetch(`https://graph.facebook.com/v21.0/${APP_ID}/settings`, {
    method: "POST", 
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      access_token: appToken,
    }).toString()
  });

  // Read current settings to check
  const readRes = await fetch(`https://graph.facebook.com/v21.0/${APP_ID}?fields=app_domains,website_url&access_token=${appToken}`);
  const readData = await readRes.json();

  return new Response(JSON.stringify({
    update_result: updateData,
    current_settings: readData,
    next_step: "Now configure Valid OAuth Redirect URIs via /api/meta-setup-oauth"
  }, null, 2), {headers: {"Content-Type": "application/json"}});
};

export const config = { path: "/api/meta-setup" };
