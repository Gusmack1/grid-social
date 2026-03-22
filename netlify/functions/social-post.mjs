export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { token, image_url, fb_text, ig_text, platform } = await req.json();
  const PAGE_ID = '978717005332489';
  const IG_ID = '17841441580105982';
  const BASE = 'https://graph.facebook.com/v25.0';

  try {
    // Try to get page token, fall back to provided token
    let pageToken = token;
    try {
      const accountsRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
      const accountsData = await accountsRes.json();
      if (accountsData.data && accountsData.data.length > 0) {
        const page = accountsData.data.find(p => p.id === PAGE_ID);
        if (page && page.access_token) {
          pageToken = page.access_token;
        }
      }
    } catch(e) {}

    if (platform === 'facebook') {
      const fbParams = new URLSearchParams({ url: image_url, message: fb_text, access_token: pageToken });
      const fbRes = await fetch(`${BASE}/${PAGE_ID}/photos?${fbParams}`, { method: 'POST' });
      const fbData = await fbRes.json();
      return Response.json({ platform: 'facebook', success: !!fbData.id, data: fbData });
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
      // Debug: check what token identity is
      const meRes = await fetch(`${BASE}/me?access_token=${token}`);
      const meData = await meRes.json();
      const permsRes = await fetch(`${BASE}/me/permissions?access_token=${token}`);
      const permsData = await permsRes.json();
      const acctRes = await fetch(`${BASE}/me/accounts?access_token=${token}`);
      const acctData = await acctRes.json();
      return Response.json({ me: meData, permissions: permsData, accounts: acctData });
    }

    return Response.json({ error: 'specify platform: facebook, instagram, or test' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = {
  path: "/api/social-post"
};
