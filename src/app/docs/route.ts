export const dynamic = 'force-dynamic';

/**
 * Standalone Swagger UI page (served as raw HTML so it is not wrapped by the
 * app shell). Renders the live OpenAPI document at /api/openapi.json.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Veebase RCM API Reference</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #f8fafc; }
    #header { background:#0b1020; color:#fff; padding:18px 24px; font-family: ui-sans-serif, system-ui, sans-serif; }
    #header h1 { margin:0; font-size:18px; font-weight:700; }
    #header p { margin:4px 0 0; font-size:13px; color:#94a3b8; }
    #header code { background:#1e293b; padding:1px 6px; border-radius:4px; }
  </style>
</head>
<body>
  <div id="header">
    <h1>Veebase RCM Intelligence — Integration API</h1>
    <p>Inbound claims (JSON &amp; FHIR R4) · autonomous agent processing · eligibility · signed webhooks. Auth: <code>X-API-Key</code> header.</p>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
