# markduek.github.io

Mark's static Astro site, with an interactive WebGL topographic landing page.
Flat warm ivory (`#EAE8DC`), muted olive (`#8C9870`), no texture or runtime libraries.

## Development

Use Node.js 24 (see `.node-version`).

```sh
npm ci
npm run dev
```

`npm run check` checks types and Astro files. `npm run build` generates `dist/`;
`npm run preview` serves the production build locally.

### Browser checks

```sh
npx playwright install chromium
npm test
```

Tests build and serve the production site, then check desktop and mobile
rendering, shader errors, stationary hover pulling, spring relaxation, touch
release/scrolling, resizing,
reduced motion, hidden-tab suspension, and the no-WebGL/no-JavaScript fallback.
Screenshots are saved under `test-results/`.

## Structure

```text
src/
  pages/                 Routes: /, /cv/, /projects/
  layouts/
    Document.astro       HTML shell and metadata; no navigation or page layout
    SiteLayout.astro     Optional shared navigation and content container
  shaders/               GLSL sources, grouped by landing page or project
  scripts/topography.js  WebGL setup, animation, resizing, pointer interaction
  components/            Landing canvas and static SVG fallback
  assets/projects/       Project images and other imported assets
  styles/global.css      Minimal shared defaults
public/
  documents/             PDFs served unchanged at /documents/<filename>.pdf
```

### Independent page designs

Add a project at `src/pages/projects/<slug>.astro` to publish `/projects/<slug>/`.
Keep its markup and scoped `<style>` in that file. Use `SiteLayout` for the
standard navigation, or `Document` for an independent, full-screen design.
Only the small global stylesheet applies to every page.

Put images in `src/assets/projects/<slug>/` and import them from the page.
Extract further shared components only when needed.

### GLSL shaders

- `src/shaders/landing/fullscreen.vert`: fullscreen triangle.
- `src/shaders/landing/background.frag`: right-shifted, merging terrain hills;
  bold ribbons emerge near their crests and flow outward into loops and necks.
- `src/scripts/topography.js`: vanilla JavaScript renderer and interaction.
- `src/components/ShaderCanvas.astro`: imports those files with `?raw` and
  embeds them in the landing page; no external runtime asset paths or requests.

Hovering adds an attractive hill to the same surface. A damped spring lets it
lag and stretch with the mouse, hold a connection while stationary, and relax
after leaving. Touch release and cancellation also let it relax.

Tune colors, hill centers/radii, ribbon spacing/widths, and motion rates in the
fragment shader. The renderer caps drawing at 30 fps, 1.5× device resolution,
1.5 million pixels, and 2048 pixels per dimension. It suspends rendering while
hidden. Reduced motion produces a still frame and disables pointer distortion.
The static SVG remains visible without JavaScript, WebGL, derivative support,
or after context loss. Touch handlers are passive and never prevent scrolling.

### Curriculum PDFs

Add the real PDFs to `public/documents/`, then link to them from
`src/pages/cv.astro`. No placeholder PDF links are published.

## Deployment

In the repository's **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source. Pushes to `main` then check, build, and deploy
the site using `.github/workflows/deploy.yml`, including the Chromium checks
before deployment.

The public URL is `https://markduek.github.io/`. The build is entirely static;
there is no backend. The landing page's scripts, shaders, styles, and fallback
are embedded, so they also work when served from a subdirectory.
