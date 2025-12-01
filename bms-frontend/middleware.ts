import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'bms_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET (or JWT_SECRET) is not set');
  }
  return new TextEncoder().encode(secret);
}

async function verifySessionToken(token: string): Promise<{
  userId: string;
  organizationId?: string | undefined;
  roles: string[];
} | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    const userId = typeof payload.userId === 'string' ? payload.userId : undefined;
    const organizationId =
      typeof payload.organizationId === 'string' ? payload.organizationId : undefined;
    const roles = Array.isArray(payload.roles)
      ? (payload.roles.filter((r) => typeof r === 'string') as string[])
      : [];

    if (!userId || roles.length === 0) {
      return null;
    }

    return { userId, organizationId, roles };
  } catch {
    return null;
  }
}

/**
 * Middleware to protect routes and redirect unauthenticated users.
 * Runs on the edge before the request reaches the route handler.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/tenant/login',
    '/tenant/signup',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/request-otp',
    '/api/auth/verify-otp',
    '/api/auth/tenant/set-password',
    '/api/health',
    // PWA files - must be publicly accessible
    '/manifest.json',
    '/sw.js',
    '/offline.html',
  ];

  // Check if route is public
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    const publicResponse = NextResponse.next();
    // Attach pathname for use in layouts
    publicResponse.headers.set('x-pathname', pathname);
    return publicResponse;
  }

  // API routes - allow through, let individual routes handle auth
  if (pathname.startsWith('/api/')) {
    // Seed endpoints are protected by NODE_ENV check in the route itself
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    // No session - redirect to appropriate login page
    return redirectToLogin(pathname, request);
  }

  // Verify session token
  const context = await verifySessionToken(token);

  if (!context) {
    // Invalid session - redirect to login
    return redirectToLogin(pathname, request);
  }

  // Check route protection rules
  const response = NextResponse.next();

  // Attach auth context to request headers for use in route handlers
  response.headers.set('x-user-id', context.userId);
  if (context.organizationId) {
    response.headers.set('x-organization-id', context.organizationId);
  }
  response.headers.set('x-user-roles', context.roles.join(','));
  // Attach pathname for use in layouts
  response.headers.set('x-pathname', pathname);

  // Tenant routes - require TENANT role
  if (pathname.startsWith('/tenant/')) {
    if (!context.roles.includes('TENANT')) {
      return redirectToLogin(pathname, request, '/tenant/login');
    }
    return response;
  }

  // Admin/staff routes - require staff role (not TENANT)
  if (pathname.startsWith('/admin/') || pathname.startsWith('/org/')) {
    if (context.roles.includes('TENANT')) {
      // Tenants should not access staff areas
      return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
    }
    // Staff routes require at least one staff role
    const staffRoles = [
      'SUPER_ADMIN',
      'ORG_ADMIN',
      'BUILDING_MANAGER',
      'FACILITY_MANAGER',
      'ACCOUNTANT',
      'SECURITY',
      'TECHNICIAN',
      'AUDITOR',
    ];
    if (!context.roles.some((role) => staffRoles.includes(role))) {
      return redirectToLogin(pathname, request);
    }
    return response;
  }

  return response;
}

/**
 * Redirects to the appropriate login page based on the requested route.
 */
function redirectToLogin(
  pathname: string,
  request: NextRequest,
  defaultLogin = '/login',
): NextResponse {
  // Tenant routes redirect to tenant login
  if (pathname.startsWith('/tenant/')) {
    const url = new URL('/tenant/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Staff/admin routes redirect to staff login
  if (pathname.startsWith('/admin/') || pathname.startsWith('/org/')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Default to staff login
  const url = new URL(defaultLogin, request.url);
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - PWA files (manifest.json, sw.js, offline.html)
     * - public folder assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
