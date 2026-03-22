export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  if (!META_TOKEN) return new Response(JSON.stringify({error:"No token"}), {status:500});

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "debug";
  const PAGE_ID = "978717005332489";
  const IG_ID = "17841441580105982";

  // Get page token via system user token
  const acctRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}`);
  const acctData = await acctRes.json();
  
  if (!acctData.data?.length) {
    return new Response(JSON.stringify({
      error: "No pages from /me/accounts",
      raw: acctData,
      token_prefix: META_TOKEN.substring(0, 20)
    }), {status:500, headers:{"Content-Type":"application/json"}});
  }

  const PAGE_TOKEN = acctData.data[0].access_token;

  if (action === "debug") {
    // Test what permissions we actually have
    const debugRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${META_TOKEN}`);
    const debugPerms = await debugRes.json();
    
    // Test page token info
    const tokenInfo = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${PAGE_TOKEN}&access_token=${META_TOKEN}`);
    const tokenData = await tokenInfo.json();

    return new Response(JSON.stringify({
      system_user_token_prefix: META_TOKEN.substring(0, 25),
      page_token_prefix: PAGE_TOKEN.substring(0, 25),
      page_id: acctData.data[0].id,
      page_name: acctData.data[0].name,
      permissions: debugPerms.data,
      page_token_debug: tokenData.data
    }, null, 2), {headers:{"Content-Type":"application/json"}});
  }

  if (action === "test-delete" && req.method === "POST") {
    const body = await req.json();
    const post_id = body.post_id;
    const platform = body.platform || "facebook";
    const results = [];

    // Try 1: Page token
    const r1 = await fetch(`https://graph.facebook.com/v21.0/${post_id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
    const d1 = await r1.json();
    results.push({method: "page_token", status: r1.status, result: d1});

    if (!d1.success) {
      // Try 2: System user token  
      const r2 = await fetch(`https://graph.facebook.com/v21.0/${post_id}?access_token=${META_TOKEN}`, {method:"DELETE"});
      const d2 = await r2.json();
      results.push({method: "system_user_token", status: r2.status, result: d2});
    }

    if (!results.some(r => r.result.success)) {
      // Try 3: Page token with explicit page_id scope
      const r3 = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}_${post_id.split('_').pop()}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
      const d3 = await r3.json();
      results.push({method: "page_scoped_id", status: r3.status, result: d3});
    }

    return new Response(JSON.stringify({post_id, platform, results}, null, 2), {headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({actions: ["debug", "test-delete"]}), {headers:{"Content-Type":"application/json"}});
};

export const config = { path: "/api/social-debug" };
