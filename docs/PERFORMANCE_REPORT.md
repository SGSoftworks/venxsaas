# VenxPOS — Performance Report

**Version**: 1.0.0
**Date**: 2026-06-19
**Stack**: React 19, Vite 8, Tailwind CSS 4, GSAP 3, Zustand 5

---

## 1. Build Optimization

### Current Configuration (`vite.config.ts`)

```typescript
build: {
  sourcemap: false,             // Disabled in production
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        supabase: ['@supabase/supabase-js'],
        animation: ['gsap', 'motion'],
      },
    },
  },
}
```

### Code Splitting Strategy

| Chunk | Contents | Estimated Size | Cache Strategy |
|-------|----------|---------------|----------------|
| `vendor` | React 19, React DOM, React Router | ~45 KB gzipped | Immutable (hash) |
| `supabase` | Supabase JS client | ~55 KB gzipped | Immutable (hash) |
| `animation` | GSAP + ScrollTrigger, Motion | ~35 KB gzipped | Immutable (hash) |
| Main bundle | App code, components | ~30 KB gzipped | Immutable (hash) |
| CSS | Tailwind 4 (purged) | ~10 KB gzipped | Immutable (hash) |
| **Total** | All chunks | **~175 KB gzipped** | — |

### Tree Shaking

Vite/Rollup automatically tree-shakes:
- **lucide-react**: Only imported icons are bundled (not entire library).
- **react-hook-form**: Only hooks used are included.
- **zod**: Only used validators and types are included.
- **gsap**: ScrollTrigger plugin is only loaded when registered.

### Additional Optimization Opportunities

```typescript
// Future optimization: Dynamic imports for route-level code splitting
const DashboardHome = lazy(() => import('@/components/dashboard/DashboardHome'))
const SubscriptionPage = lazy(() => import('@/components/dashboard/SubscriptionPage'))
const BranchesPage = lazy(() => import('@/components/dashboard/BranchesPage'))
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard'))
const AdminClients = lazy(() => import('@/components/admin/AdminClients'))
const AdminPayments = lazy(() => import('@/components/admin/AdminPayments'))
```

---

## 2. Bundle Size Analysis

### Current Dependencies

| Package | Version | Size (unpacked) | Tree-shakeable | Notes |
|---------|---------|-----------------|---------------|-------|
| react | 19.2.6 | ~6 KB | N/A | Core framework |
| react-dom | 19.2.6 | ~130 KB | N/A | DOM renderer |
| react-router-dom | 7.4.0 | ~35 KB | Partially | Route components |
| @supabase/supabase-js | 2.108.2 | ~150 KB | Partially | Full supabase client |
| gsap | 3.13.0 | ~100 KB | Yes (plugins) | Animation library |
| motion | 12.5.0 | ~100 KB | Yes | Animation library (duplicate?) |
| lucide-react | 1.20.0 | ~0 KB (tree-shaken) | Yes | Icon imports only |
| react-hook-form | 7.54.2 | ~30 KB | Yes | Form library |
| @hookform/resolvers | 3.9.1 | ~5 KB | Yes | Zod resolver |
| zod | 3.24.2 | ~15 KB | Yes | Validation |
| zustand | 5.0.14 | ~3 KB | N/A | State management |

### Bundle Optimization Recommendations

1. **Consider removing `motion`**: GSAP is already used for complex animations. If `motion` (Framer Motion successor) is only used for simple transitions, consider replacing with CSS transitions or Tailwind animations.

2. **Lazy-load GSAP only on landing page**: GSAP with ScrollTrigger is only needed on `LandingPage`. Dynamic import:
   ```typescript
   const LandingPage = lazy(() => import('@/components/landing/LandingPage'))
   ```

3. **Supabase client code-split by domain**: Currently the full Supabase client is loaded even for unauthenticated users on the landing page. Consider:
   - Only initialize client when needed (after auth)
   - Use Supabase's modular imports if available

4. **`@supabase/supabase-js` tree-shaking**: Supabase JS v2 bundles all modules (auth, realtime, storage, postgrest). For the SaaS app, `realtime` and `storage` modules may be unused.

---

## 3. Image Optimization Strategy

### Current State
- No raster images in the SaaS app (icon-based SVGs from lucide-react)
- Favicon is SVG (optimal)
- Landing page uses icon components, not images

### Future Imagery (if adding)

| Type | Format | Optimization |
|------|--------|-------------|
| Hero illustrations | SVG inline | No optimization needed |
| Screenshots / mockups | WebP + PNG fallback | `<picture>` with `srcset` |
| OG image | PNG (optimized) | `optipng` or `squoosh` |
| Product photos (blog) | WebP + lazy loading | `loading="lazy"` + `decoding="async"` |
| User avatars | WebP | Served optimized from Supabase Storage |

### Image Component Pattern

```tsx
// For future image-heavy pages
<picture>
  <source srcSet="/images/hero.webp" type="image/webp" />
  <source srcSet="/images/hero.png" type="image/png" />
  <img
    src="/images/hero.png"
    alt="VenxPOS dashboard"
    loading="lazy"
    decoding="async"
    width="1200"
    height="630"
  />
</picture>
```

---

## 4. Font Loading Strategy

### Current State
- Using Tailwind's default font stack (system fonts)
- No custom web fonts loaded
- `antialiased` class on `<body>` for font smoothing

### If Custom Fonts Are Added

```html
<!-- Preload critical font -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin />

<!-- Font display strategy -->
<style>
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-var.woff2') format('woff2');
    font-display: swap; /* Show fallback text until font loads */
  }
</style>
```

**Recommendation:** Stay with system fonts for the SaaS app. They load instantly and perform excellently. Only add custom fonts for the marketing/landing page if brand guidelines require it.

---

## 5. Caching Headers (via Vercel)

### Default Vercel Caching

| Asset Type | Cache Duration | Cache-Control |
|-----------|---------------|---------------|
| HTML | Short (no cache) | `public, max-age=0, must-revalidate` |
| JS/CSS (hashed) | 1 year (immutable) | `public, max-age=31536000, immutable` |
| Static assets | 1 year | `public, max-age=31536000` |
| `/favicon.svg` | 1 week | `public, max-age=604800` |

### Custom Caching (Vercel Headers)

Add to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/favicon.svg",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=604800" }
      ]
    }
  ]
}
```

### CDN Strategy

Vercel's global edge network caches static assets automatically. No additional CDN configuration needed.

---

## 6. Supabase Query Optimization

### Current Query Patterns

```typescript
// useAuthStore.initialize() - runs on every app load
const { data: { session } } = await supabase.auth.getSession()         // 1 query
const { data: tenants } = await supabase.from('tenants').select('*')   // 2 queries
  .eq('auth_user_id', session.user.id).maybeSingle()
const { data: planData } = await supabase.from('plans').select('*')    // 3 queries
  .eq('id', tenants.plan_id).single()
const { data: subData } = await supabase.from('subscriptions')         // 4 queries
  .select('*').eq('tenant_id', tenants.id).maybeSingle()
const { data: superData } = await supabase.from('superadmins')         // 5 queries
  .select('*').eq('user_id', session.user.id).maybeSingle()
```

**Total queries on app load: 5 sequential queries.**

### Optimization: Single Query with Joins

```typescript
// Optimized: 1 query instead of 5
const { data } = await supabase
  .from('tenants')
  .select(`
    *,
    plans (*),
    subscriptions (*)
  `)
  .eq('auth_user_id', session.user.id)
  .maybeSingle()

const { data: superData } = await supabase
  .from('superadmins')
  .select('id')
  .eq('user_id', session.user.id)
  .maybeSingle()
```

**Reduction: 5 queries → 2 queries (60% fewer).**

### Index Usage Verification

Verify that the following hot-path queries use indexes (check with `EXPLAIN ANALYZE`):

```sql
-- Query 1: Auth init (should use idx_tenants_auth_user_id)
EXPLAIN ANALYZE SELECT * FROM tenants WHERE auth_user_id = '...';

-- Query 2: Subscription lookup (should use idx_subscriptions_tenant_id)
EXPLAIN ANALYZE SELECT * FROM subscriptions WHERE tenant_id = '...';

-- Query 3: Payment history (should use idx_payments_tenant_id + idx_payments_created_at)
EXPLAIN ANALYZE SELECT * FROM payments
WHERE tenant_id = '...' ORDER BY created_at DESC LIMIT 20;

-- Query 4: Admin KPIs (should use idx_payments_status + idx_tenants_estado)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM tenants WHERE estado = 'active';
SELECT SUM(amount) FROM payments WHERE status = 'approved'
  AND created_at > NOW() - INTERVAL '30 days';
```

### RLS Performance Impact

RLS policies add a subquery to every request. For example:

```sql
-- Without RLS: simple index scan
SELECT * FROM payments WHERE tenant_id = '...';

-- With RLS: adds tenant ownership check
SELECT * FROM payments
WHERE tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
  OR is_superadmin();
```

**Impact:** Negligible for indexed queries (< 1ms overhead per policy check). The `tenant_id` column is indexed on all SaaS tables. The `tenants.auth_user_id` column is also indexed.

### Connection Pooling

Supabase manages connection pooling automatically via PgBouncer. Monitor pool utilization in Supabase Dashboard → Database → Pool.

---

## 7. GSAP Performance Considerations

### Current Usage

- GSAP + ScrollTrigger used extensively on `LandingPage` for scroll-triggered animations
- GSAP not used on dashboard or admin pages

### Best Practices Implemented

1. **ScrollTrigger.refresh()**: Called after all animations are created (handled by GSAP).
2. **Plugin registration**: `gsap.registerPlugin(ScrollTrigger)` at module level.
3. **Cleanup**: GSAP animations should be killed on component unmount.

### Recommended Improvements

```typescript
// Add cleanup in useEffect return
useEffect(() => {
  const ctx = gsap.context(() => {
    // All GSAP animations for this component
    gsap.from('.hero-title', { opacity: 0, y: 50 })
    ScrollTrigger.create({ ... })
  })

  return () => ctx.revert()  // Kill all animations on unmount
}, [])
```

### Performance Tips

1. **Avoid animating layout-triggering properties**: Prefer `transform` over `top/left/width/height`.
2. **Use `will-change` sparingly**: Only on elements that actually animate.
3. **Reduce animations on low-end devices**: Use `ScrollTrigger.matchMedia()` to conditionally enable animations.
4. **Debounce scroll handlers**: GSAP's ScrollTrigger already handles this efficiently.
5. **Respect `prefers-reduced-motion`**:

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (prefersReducedMotion) {
  // Skip animations or use instant transitions
  ScrollTrigger.refresh()
} else {
  // Full animation suite
}
```

---

## 8. Lighthouse Audit Plan

### When to Audit

| Frequency | Scope | Tool |
|-----------|-------|------|
| Every PR | Landing page only | Lighthouse CI in GitHub Actions |
| Weekly | All public pages | Chrome DevTools Lighthouse |
| Monthly | Full site audit | Lighthouse + Web Vitals library |

### Lighthouse CI Configuration

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse Audit
on:
  pull_request:
    paths:
      - 'src/**'
      - 'index.html'

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx serve dist &
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:3000/
            http://localhost:3000/login
          budgetPath: .github/lighthouse/budget.json
          uploadArtifacts: true
```

### Performance Budget

```json
{
  "budget": [
    {
      "resourceType": "script",
      "budget": 200
    },
    {
      "resourceType": "stylesheet",
      "budget": 50
    },
    {
      "resourceType": "total",
      "budget": 500
    },
    {
      "metric": "LCP",
      "budget": 2500
    },
    {
      "metric": "FID",
      "budget": 100
    },
    {
      "metric": "CLS",
      "budget": 0.1
    },
    {
      "metric": "TBT",
      "budget": 300
    }
  ]
}
```

### Target Scores

| Audit | Target | Current | Action |
|-------|--------|---------|--------|
| FCP (First Contentful Paint) | < 1.8s | — | Minimize render-blocking resources |
| LCP (Largest Contentful Paint) | < 2.5s | — | Optimize hero images, preload fonts |
| TBT (Total Blocking Time) | < 200ms | — | Reduce JS execution, code split |
| CLS (Cumulative Layout Shift) | < 0.1 | — | Set image dimensions, avoid late-loading fonts |
| SI (Speed Index) | < 3.4s | — | Optimize above-fold rendering |

---

## 9. Performance Monitoring

### Real User Monitoring (RUM)

Use Vercel Analytics (included with Vercel):
- **Web Vitals**: LCP, FID, CLS tracking across real users
- **Analytics**: Page views, unique visitors, geography

Or implement custom Web Vitals tracking:

```typescript
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals'

function sendToAnalytics(metric) {
  console.log(metric)
  // Send to Supabase events_auditoria or external service
}

onCLS(sendToAnalytics)
onFID(sendToAnalytics)
onLCP(sendToAnalytics)
onTTFB(sendToAnalytics)
```

### Performance Regression Detection

- **Lighthouse CI**: Block PRs if performance degrades below budget
- **Vercel Analytics**: Monitor Web Vitals trend over time
- **Manual testing**: Run Lighthouse on staging before production deploy

---

*End of Performance Report*
