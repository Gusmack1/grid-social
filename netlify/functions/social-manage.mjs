export default async (req) => {
  const META_TOKEN = Netlify.env.get("META_USER_TOKEN");
  const USER_TOKEN = Netlify.env.get("META_LONG_USER_TOKEN");
  if (!META_TOKEN) return new Response(JSON.stringify({error:"No META_USER_TOKEN"}), {status:500});

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const IG_ID = "17841441580105982";

  // Get page token from system user
  let PAGE_TOKEN, PAGE_ID;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${META_TOKEN}`);
    const d = await r.json();
    if (!d.data?.length) throw new Error("No pages");
    PAGE_TOKEN = d.data[0].access_token;
    PAGE_ID = d.data[0].id;
  } catch(e) {
    return new Response(JSON.stringify({error:`Auth: ${e.message}`}), {status:500});
  }

  // Also get user page token if user token exists (for IG deletion)
  let USER_PAGE_TOKEN = null;
  if (USER_TOKEN) {
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${USER_TOKEN}`);
      const d = await r.json();
      if (d.data?.length) USER_PAGE_TOKEN = d.data[0].access_token;
    } catch(e) { /* ignore — fall back to system token */ }
  }

  // LIST
  if (action === "list") {
    const [fbR, igR] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id,message,created_time,full_picture`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id,caption,timestamp,media_url,permalink`)
    ]);
    const [fb, ig] = await Promise.all([fbR.json(), igR.json()]);
    return new Response(JSON.stringify({
      facebook: fb.data || [], instagram: ig.data || [],
      page_id: PAGE_ID, ig_id: IG_ID,
      has_user_token: !!USER_PAGE_TOKEN
    }), {headers:{"Content-Type":"application/json"}});
  }

  // DELETE
  if (action === "delete" && req.method === "POST") {
    const body = await req.json();
    const fb_ids = body.fb_ids || body.ids || [];
    const ig_ids = body.ig_ids || [];
    const results = { facebook: [], instagram: [] };

    // FB delete — try page token, then user token, then system token
    for (const id of fb_ids) {
      let success = false, error = null;
      for (const tok of [PAGE_TOKEN, USER_PAGE_TOKEN, USER_TOKEN, META_TOKEN].filter(Boolean)) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${tok}`, {method:"DELETE"});
          const d = await r.json();
          if (d.success) { success = true; break; }
          error = d.error?.message;
        } catch(e) { error = e.message; }
      }
      results.facebook.push({id, success, error: success ? undefined : error});
    }

    // IG delete — MUST use user page token (system tokens can't delete IG)
    for (const id of ig_ids) {
      if (!USER_PAGE_TOKEN && !USER_TOKEN) {
        results.instagram.push({id, success: false, error: "No user token. Visit /api/meta-auth to authorize."});
        continue;
      }
      let success = false, error = null;
      for (const tok of [USER_PAGE_TOKEN, USER_TOKEN, PAGE_TOKEN, META_TOKEN].filter(Boolean)) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${tok}`, {method:"DELETE"});
          const d = await r.json();
          if (d.success) { success = true; break; }
          error = d.error?.message;
        } catch(e) { error = e.message; }
      }
      results.instagram.push({id, success, error: success ? undefined : error});
    }

    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  // PURGE
  if (action === "purge" && req.method === "POST") {
    const body = await req.json();
    const keep_fb = new Set(body.keep_fb || []);
    const keep_ig = new Set(body.keep_ig || []);

    const [fbR, igR] = await Promise.all([
      fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed?access_token=${PAGE_TOKEN}&limit=100&fields=id`),
      fetch(`https://graph.facebook.com/v21.0/${IG_ID}/media?access_token=${PAGE_TOKEN}&limit=100&fields=id`)
    ]);
    const [fb, ig] = await Promise.all([fbR.json(), igR.json()]);
    const del_fb = (fb.data||[]).filter(p=>!keep_fb.has(p.id)).map(p=>p.id);
    const del_ig = (ig.data||[]).filter(p=>!keep_ig.has(p.id)).map(p=>p.id);

    // Redirect to delete action
    const fakeReq = new Request(req.url + "&action=delete", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({fb_ids: del_fb, ig_ids: del_ig})
    });

    // Inline delete logic
    const results = { facebook: [], instagram: [], summary: {} };
    for (const id of del_fb) {
      let success = false, error = null;
      for (const tok of [PAGE_TOKEN, USER_PAGE_TOKEN, USER_TOKEN, META_TOKEN].filter(Boolean)) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${tok}`, {method:"DELETE"});
          const d = await r.json();
          if (d.success) { success = true; break; }
          error = d.error?.message;
        } catch(e) { error = e.message; }
      }
      results.facebook.push({id, success, error: success ? undefined : error});
    }
    for (const id of del_ig) {
      if (!USER_PAGE_TOKEN && !USER_TOKEN) {
        results.instagram.push({id, success: false, error: "No user token"});
        continue;
      }
      let success = false, error = null;
      for (const tok of [USER_PAGE_TOKEN, USER_TOKEN, PAGE_TOKEN, META_TOKEN].filter(Boolean)) {
        try {
          const r = await fetch(`https://graph.facebook.com/v21.0/${id}?access_token=${tok}`, {method:"DELETE"});
          const d = await r.json();
          if (d.success) { success = true; break; }
          error = d.error?.message;
        } catch(e) { error = e.message; }
      }
      results.instagram.push({id, success, error: success ? undefined : error});
    }
    results.summary = {
      fb_deleted: results.facebook.filter(r=>r.success).length,
      fb_failed: results.facebook.filter(r=>!r.success).length,
      ig_deleted: results.instagram.filter(r=>r.success).length,
      ig_failed: results.instagram.filter(r=>!r.success).length
    };
    return new Response(JSON.stringify(results), {headers:{"Content-Type":"application/json"}});
  }

  // STATUS
  if (action === "status") {
    const expires = Netlify.env.get("META_TOKEN_EXPIRES");
    const hasUserToken = !!USER_TOKEN;
    const hasUserPageToken = !!USER_PAGE_TOKEN;
    let daysLeft = null;
    if (expires) {
      daysLeft = Math.round((new Date(expires) - new Date()) / 86400000);
    }
    return new Response(JSON.stringify({
      system_token: !!META_TOKEN,
      user_token: hasUserToken,
      user_page_token: hasUserPageToken,
      token_expires: expires || "not set",
      days_until_expiry: daysLeft,
      ig_delete_capable: hasUserToken || hasUserPageToken,
      auth_url: hasUserToken ? null : "https://gridsocial.co.uk/api/meta-auth"
    }), {headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({
    actions: [
      "GET ?action=list — list all FB+IG posts",
      "GET ?action=status — check token status",
      "POST ?action=delete {fb_ids,ig_ids} — delete specific posts",
      "POST ?action=purge {keep_fb,keep_ig} — delete all except specified"
    ]
  }), {status:400, headers:{"Content-Type":"application/json"}});
};

export const config = { path: "/api/social-manage" };
