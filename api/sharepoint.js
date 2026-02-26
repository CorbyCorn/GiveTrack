// /api/sharepoint.js
// Vercel Serverless Function — fetches Excel data from SharePoint via Microsoft Graph
//
// Required environment variables (set in Vercel dashboard → Settings → Environment Variables):
//   MSGRAPH_TENANT_ID     — Your Microsoft 365 tenant ID
//   MSGRAPH_CLIENT_ID     — App registration client ID from Entra
//   MSGRAPH_CLIENT_SECRET — App registration client secret from Entra
//   SHAREPOINT_SITE_ID    — SharePoint site ID
//   SHAREPOINT_FILE_PATH  — Path to the Excel file in the document library

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    MSGRAPH_TENANT_ID,
    MSGRAPH_CLIENT_ID,
    MSGRAPH_CLIENT_SECRET,
    SHAREPOINT_SITE_ID,
    SHAREPOINT_FILE_PATH,
  } = process.env;

  // Check env vars
  if (!MSGRAPH_TENANT_ID || !MSGRAPH_CLIENT_ID || !MSGRAPH_CLIENT_SECRET || !SHAREPOINT_SITE_ID) {
    return res.status(500).json({ error: "Server configuration incomplete. Contact admin." });
  }

  try {
    // Step 1: Get an access token using client credentials flow
    const tokenUrl = `https://login.microsoftonline.com/${MSGRAPH_TENANT_ID}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: MSGRAPH_CLIENT_ID,
      client_secret: MSGRAPH_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token error:", err);
      return res.status(500).json({ error: "Failed to authenticate with Microsoft Graph" });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Read the Excel file from SharePoint
    // The sheet name is "2026 Log" — URL-encode it
    const sheetName = encodeURIComponent("2026 Log");
    const filePath = SHAREPOINT_FILE_PATH || "/Donations Tracking.xlsx";
    const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");

    // Use the drive item path to access the file
    const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive/root:${encodedPath}:/workbook/worksheets/${sheetName}/usedRange`;

    const graphRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!graphRes.ok) {
      const err = await graphRes.text();
      console.error("Graph API error:", err);
      return res.status(500).json({ error: "Failed to read SharePoint file" });
    }

    const data = await graphRes.json();

    // Return the cell values (2D array of rows)
    return res.status(200).json({
      values: data.values || [],
      rowCount: data.values?.length || 0,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
