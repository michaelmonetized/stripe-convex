"use client";

import { useState, useEffect } from "react";
import type { HasProps } from "../types/index.js";
import { useStripeConvex } from "./context.js";

/**
 * Has component - conditionally renders children based on user access
 * Checks if the user (by email) has access to a specific feature or plan
 */
export function Has({ feature, plan, user, children, fallback }: HasProps) {
  const { hasAccess } = useStripeConvex();
  const [access, setAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const result = await hasAccess({ feature, plan, email: user });
        if (!cancelled) {
          setAccess(result);
        }
      } catch (error) {
        console.error("Failed to check access:", error);
        if (!cancelled) {
          setAccess(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [feature, plan, user, hasAccess]);

  // Show nothing while loading
  if (loading) {
    return null;
  }

  // Show children if has access, fallback otherwise
  if (access) {
    return <>{children}</>;
  }

  return <>{fallback || null}</>;
}

/**
 * Hook version of Has component for more flexible usage
 */
export function useHasAccess(params: {
  feature?: string;
  plan?: string;
  user: string;
}): { hasAccess: boolean | null; loading: boolean } {
  const { hasAccess: checkAccess } = useStripeConvex();
  const [access, setAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const result = await checkAccess({
          feature: params.feature,
          plan: params.plan,
          email: params.user,
        });
        if (!cancelled) {
          setAccess(result);
        }
      } catch (error) {
        console.error("Failed to check access:", error);
        if (!cancelled) {
          setAccess(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [params.feature, params.plan, params.user, checkAccess]);

  return { hasAccess: access, loading };
}
