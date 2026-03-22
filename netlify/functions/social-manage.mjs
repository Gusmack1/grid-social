// Social media management API — list, delete, post
// Full control: FB posts, IG posts, comments
// Endpoint: /api/social-manage

export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  if (!META_TOKEN) return new Response(JSON.stringify({error:"No META_USER_TOKEN"}), {status:500});

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const IG_ID = "17841441580105982";

  // Get page token (needed for all operations)
  let PAGE_TOKEN, PAGE_ID;
  try {
    const acctRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}`);
    const acctData = await acctRes.json();
    if (!acctData.data?.length) throw new Error("No pages found");
    PAGE_TOKEN = acctData.data[0].access_token;
    PAGE_ID = acctData.data[0].id;
  } catch(e) {
    return new Response(JSON.stringify({error: `Auth failed: ${e.message}`}), {status:500});
  }

  // === LIST all posts ===
  if (action === "list") {
    const [fbRes, igRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id,message,created_time,full_picture`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id,caption,timestamp,media_url,permalink`)
    ]);
    const [fbData, igData] = await Promise.all([fbRes.json(), igRes.json()]);
    return new Response(JSON.stringify({
      facebook: fbData.data || [],
      instagram: igData.data || [],
      page_id: PAGE_ID,
      ig_id: IG_ID
    }), {headers:{"Content-Type":"application/json"}});
  }

  // === DELETE posts (FB and/or IG) ===
  if (action === "delete" && req.method === "POST") {
    const body = await req.json();
    const fb_ids = body.fb_ids || body.ids || [];
    const ig_ids = body.ig_ids || [];
    const results = { facebook: [], instagram: [] };

    // Delete FB posts — uses page token
    for (const id of fb_ids) {
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        const d = await r.json();
        results.facebook.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.facebook.push({id, success: false, error: e.message});
      }
    }

    // Delete IG posts — uses USER token (system user) not page token
    for (const id of ig_ids) {
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
        const d = await r.json();
        results.instagram.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.instagram.push({id, success: false, error: e.message});
      }
    }

    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  // === DELETE ALL EXCEPT specified IDs ===
  if (action === "purge" && req.method === "POST") {
    const body = await req.json();
    const keep_fb = new Set(body.keep_fb || []);
    const keep_ig = new Set(body.keep_ig || []);

    // Get all posts
    const [fbRes, igRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id`)
    ]);
    const [fbData, igData] = await Promise.all([fbRes.json(), igRes.json()]);

    const del_fb = (fbData.data || []).filter(p => !keep_fb.has(p.id)).map(p => p.id);
    const del_ig = (igData.data || []).filter(p => !keep_ig.has(p.id)).map(p => p.id);

    const results = { facebook: [], instagram: [], summary: {} };

    for (const id of del_fb) {
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${PAGE_TOKEN}`, {method:"DELETE"});
        const d = await r.json();
        results.facebook.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.facebook.push({id, success: false, error: e.message});
      }
    }

    for (const id of del_ig) {
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${META_TOKEN}`, {method:"DELETE"});
        const d = await r.json();
        results.instagram.push({id, success: d.success === true, error: d.error?.message});
      } catch(e) {
        results.instagram.push({id, success: false, error: e.message});
      }
    }

    results.summary = {
      fb_deleted: results.facebook.filter(r => r.success).length,
      fb_failed: results.facebook.filter(r => !r.success).length,
      ig_deleted: results.instagram.filter(r => r.success).length,
      ig_failed: results.instagram.filter(r => !r.success).length
    };

    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({
    error: "Invalid action",
    available: {
      "GET ?action=list": "List all FB and IG posts",
      "POST ?action=delete": "Delete specific posts {fb_ids:[], ig_ids:[]}",
      "POST ?action=purge": "Delete all EXCEPT {keep_fb:[], keep_ig:[]}"
    }
  }), {status:400, headers:{"Content-Type":"application/json"}});
};

export const config = { path: "/api/social-manage" };
