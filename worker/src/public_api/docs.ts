import { Context } from "hono"

/**
 * Static Swagger UI page served at /public_api/docs. Pulls swagger-ui-dist
 * from the official jsdelivr CDN to avoid bundling ~1 MiB of vendor JS in
 * the worker artifact.
 *
 * Loads the OpenAPI spec from the same origin via /public_api/openapi.json,
 * so once the worker is deployed the docs are always in sync with the
 * actual route table.
 */

const SWAGGER_UI_VERSION = "5.17.14"
const SWAGGER_CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`

const html = (
    title: string,
    specUrl: string,
): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="index, follow" />
<title>${title}</title>
<link rel="stylesheet" href="${SWAGGER_CDN}/swagger-ui.css" />
<style>
  body { margin: 0; background: #fafafa; }
  .topbar { display: none; }
</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_CDN}/swagger-ui-bundle.js" crossorigin></script>
  <script src="${SWAGGER_CDN}/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 1,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`

const docsHandler = (c: Context<HonoCustomType>) => {
    const url = new URL(c.req.raw.url)
    const specUrl = `${url.protocol}//${url.host}/public_api/openapi.json`
    return c.html(html("Public API — cloudflare_temp_email", specUrl))
}

export default docsHandler
