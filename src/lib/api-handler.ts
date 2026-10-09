import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { getSessionUser, type AuthUser } from "@/lib/auth/session";

export interface RouteHandlerContext<TBody = unknown, TQuery = unknown, TParams = unknown> {
  req: NextRequest;
  body: TBody;
  query: TQuery;
  params: TParams;
  user: AuthUser | null;
}

export interface HandleOptions<TBody, TQuery, TParams> {
  schema?: {
    body?: z.ZodType<TBody>;
    query?: z.ZodType<TQuery>;
    params?: z.ZodType<TParams>;
  };
  requireAuth?: boolean;
  status?: number;
}

export type HandlerFn<TBody, TQuery, TParams, TResult> = (
  ctx: RouteHandlerContext<TBody, TQuery, TParams>
) => Promise<TResult> | TResult;

export function handle<TBody = void, TQuery = void, TParams = void, TResult = unknown>(
  fn: HandlerFn<TBody, TQuery, TParams, TResult>,
  options?: HandleOptions<TBody, TQuery, TParams>
) {
  return async (
    req: NextRequest,
    routeProps?: { params?: Promise<Record<string, string | string[]>> | Record<string, string | string[]> }
  ): Promise<NextResponse> => {
    try {
      // 1. Resolve and validate route params
      let params = {} as TParams;
      if (routeProps?.params) {
        const rawParams = await routeProps.params;
        if (options?.schema?.params) {
          params = options.schema.params.parse(rawParams);
        } else {
          params = rawParams as unknown as TParams;
        }
      } else if (options?.schema?.params) {
        params = options.schema.params.parse({});
      }

      // 2. Parse and validate search query params
      let query = {} as TQuery;
      if (options?.schema?.query) {
        const searchParamsObj = Object.fromEntries(req.nextUrl.searchParams.entries());
        query = options.schema.query.parse(searchParamsObj);
      }

      // 3. Parse and validate body
      let body = undefined as unknown as TBody;
      if (options?.schema?.body) {
        let json: unknown;
        try {
          json = await req.json();
        } catch {
          json = {};
        }
        body = options.schema.body.parse(json);
      }

      // 4. Authenticate user if required or available
      const user = await getSessionUser(req);
      if (options?.requireAuth && !user) {
        return NextResponse.json(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "Authentication required",
            },
          },
          { status: 401 }
        );
      }

      // 5. Execute handler function
      const result = await fn({
        req,
        body,
        query,
        params,
        user,
      });

      // If handler returned a NextResponse directly (e.g. setting custom cookies/headers)
      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json(
        { data: result },
        { status: options?.status ?? 200 }
      );
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(error.toResponse(), { status: error.statusCode });
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      console.error("Unhandled API error:", error);
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
        },
        { status: 500 }
      );
    }
  };
}
