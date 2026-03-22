export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { token, image_url, fb_text, ig_text, platform } = await req.json();
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';

  try {
    // Get page token - try multiple methods
    let pageToken = token;
    
    // Method 1: /me/accounts
    const acctRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
    const acctData = await acctRes.json();
    if (acctData.data && acctData.data.length > 0) {
      const page = acctData.data.find(p => p.id === PAGE_ID);
      if (page) pageToken = page.access_token;
    }
    
    // Method 2: Query page directly for access token
    if (pageToken === token) {
      const pageRes = await fetch(`${BASE}/${PAGE_ID}?fields=access_token&access_token=${token}`);
      const pageData = await pageRes.json();
      if (pageData.access_token) pageToken = pageData.access_token;
    }

    if (platform === 'facebook') {
      const fbParams = new URLSearchParams({ url: image_url, message: fb_text, access_token: pageToken });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      return Response.json({ platform: 'facebook', success: !!fbData.id, data: fbData, usedPageToken: pageToken !== token });
    }

    if (platform === 'instagram') {
      const igParams = new URLSearchParams({ image_url, caption: ig_text, access_token: pageToken });
      const igRes = await fetch(`${BASE}/${IG_ID}/media?${igParams}`, { method: 'POST' });
      const igData = await igRes.json();

      if (igData.id) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 2500));
          const statusRes = await fetch(`${BASE}/${igData.id}?fields=status_code&access_token=${pageToken}`);
          const statusData = await statusRes.json();
          if (statusData.status_code === 'FINISHED') break;
        }
        const pubParams = new URLSearchParams({ creation_id: igData.id, access_token: pageToken });
        const pubRes = await fetch(`${BASE}/${IG_ID}/media_publish?${pubParams}`, { method: 'POST' });
        const pubData = await pubRes.json();
        return Response.json({ platform: 'instagram', success: !!pubData.id, data: pubData, container: igData.id });
      }
      return Response.json({ platform: 'instagram', success: false, data: igData });
    }

    if (platform === 'test') {
      const meRes = await fetch(`${BASE}/me?access_token=${token}`);
      const meData = await meRes.json();
      // Try getting page token directly
      const pageRes = await fetch(`${BASE}/${PAGE_ID}?fields=access_token,name&access_token=${token}`);
      const pageData = await pageRes.json();
      return Response.json({ me: meData, page_direct: pageData, got_page_token: !!pageData.access_token, accounts: acctData });
    }

    return Response.json({ error: 'specify platform' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: "/api/social-post" };
