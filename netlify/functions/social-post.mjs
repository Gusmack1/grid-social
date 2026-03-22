export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await req.json();
  const envToken = (typeof Netlify !== 'undefined' && Netlify.env) 
    ? Netlify.env.get("META_USER_TOKEN") 
    : (typeof process !== 'undefined' && process.env) 
      ? process.env.META_USER_TOKEN 
      : null;
  const token = body.token || envToken;
  const { image_url, fb_text, ig_text, platform } = body;
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';

  if (!token) {
    return Response.json({ error: 'No token' }, { status: 401 });
  }

  try {
    // Get page token - try multiple methods
    let pageToken = token;
    let tokenMethod = 'raw';
    
    // Method 1: /me/accounts
    try {
      const acctRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
      const acctData = await acctRes.json();
      if (acctData.data && acctData.data.length > 0) {
        const page = acctData.data.find(p => p.id === PAGE_ID);
        if (page) { pageToken = page.access_token; tokenMethod = 'me_accounts'; }
      }
    } catch(e) {}
    
    // Method 2: Direct page query  
    if (tokenMethod === 'raw') {
      try {
        const pageRes = await fetch(`${BASE}/${PAGE_ID}?fields=access_token&access_token=${token}`);
        const pageData = await pageRes.json();
        if (pageData.access_token) { pageToken = pageData.access_token; tokenMethod = 'page_direct'; }
      } catch(e) {}
    }

    // Method 3: For system users, try posting directly with the token
    // System user tokens that have page assets assigned can post directly

    if (platform === 'debug') {
      const meRes = await fetch(`${BASE}/me?access_token=${token}`);
      const meData = await meRes.json();
      const pageRes = await fetch(`${BASE}/${PAGE_ID}?fields=access_token,name&access_token=${token}`);
      const pageData = await pageRes.json();
      const acctRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
      const acctData = await acctRes.json();
      return Response.json({ me: meData, page_query: pageData, accounts: acctData, tokenMethod, gotPageToken: tokenMethod !== 'raw' });
    }

    if (platform === 'facebook') {
      const params = new URLSearchParams({ url: image_url, message: fb_text, access_token: pageToken });
      const res = await fetch(`${BASE}/${PAGE_ID}/photos?${params}`, { method: 'POST' });
      const data = await res.json();
      return Response.json({ platform: 'facebook', success: !!data.id, data, tokenMethod });
    }

    if (platform === 'instagram') {
      const params = new URLSearchParams({ image_url, caption: ig_text, access_token: pageToken });
      const res = await fetch(`${BASE}/${IG_ID}/media?${params}`, { method: 'POST' });
      const data = await res.json();
      if (data.id) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const s = await fetch(`${BASE}/${data.id}?fields=status_code&access_token=${pageToken}`);
          const sd = await s.json();
          if (sd.status_code === 'FINISHED') break;
        }
        const pubParams = new URLSearchParams({ creation_id: data.id, access_token: pageToken });
        const pub = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pub.json();
        return Response.json({ platform: 'instagram', success: !!pubData.id, data: pubData, container: data.id });
      }
      return Response.json({ platform: 'instagram', success: false, data });
    }

    if (platform === 'both') {
      const results = [];
      const fbParams = new URLSearchParams({ url: image_url, message: fb_text, access_token: pageToken });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      results.push({ platform: 'facebook', success: !!fbData.id, id: fbData.id, error: fbData.error });
      const igParams = new URLSearchParams({ image_url, caption: ig_text, access_token: pageToken });
      const igRes = await fetch(`${BASE}/${IG_ID}/media?${igParams}`, { method: 'POST' });
      const igData = await igRes.json();
      if (igData.id) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const s = await fetch(`${BASE}/${igData.id}?fields=status_code&access_token=${pageToken}`);
          const sd = await s.json();
          if (sd.status_code === 'FINISHED') break;
        }
        const pubParams = new URLSearchParams({ creation_id: igData.id, access_token: pageToken });
        const pub = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pub.json();
        results.push({ platform: 'instagram', success: !!pubData.id, id: pubData.id, error: pubData.error });
      }
      return Response.json({ results, tokenMethod });
    }

    return Response.json({ error: 'specify platform' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: "/api/social-post" };
