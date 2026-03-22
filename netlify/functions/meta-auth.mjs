// GET /api/meta-auth — redirects user to Facebook login
// One-time visit: Gus clicks this link, approves, gets redirected back
export default async (req) => {
  const APP_ID = "1576303166762174";
  const REDIRECT = "https://gridsocial.co.uk/api/meta-callback";
  const SCOPES = [
    "pages_manage_posts",
    "pages_read_engagement", 
    "pages_manage_engagement",
    "pages_manage_metadata",
    "pages_read_user_content",
    "pages_show_list",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "instagram_manage_messages",
    "read_insights",
    "ads_management",
    "ads_read",
    "business_management",
    "catalog_management",
    "instagram_shopping_tag_products",
    "instagram_branded_content_brand",
    "instagram_branded_content_ads_brand"
  ].join(",");

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${SCOPES}&response_type=code`;

  return Response.redirect(authUrl, 302);
};

export const config = { path: "/api/meta-auth" };
