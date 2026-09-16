import type { Response } from "express";
import type { AuthenticatedRequest, AuthenticatedUser } from "../../middlewares/auth.middleware.js";

type ControllerHandler = (req: AuthenticatedRequest, res: Response) => unknown;

export interface ControllerInput {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface ControllerResult<T = any> {
  status: number;
  body: T;
}

/**
 * Exécute un contrôleur Express existant hors HTTP avec un faux req/res, pour
 * réutiliser telle quelle la validation, les règles de périmètre et de quotas.
 */
export function invokeController<T = any>(
  handler: ControllerHandler,
  user: AuthenticatedUser,
  input: ControllerInput = {},
  timeoutMs = 60_000
): Promise<ControllerResult<T>> {
  return new Promise((resolve, reject) => {
    let status = 200;
    let settled = false;

    const finish = (body: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, body: body as T });
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Le traitement interne a dépassé le délai imparti."));
      }
    }, timeoutMs);

    const res: any = {
      headersSent: false,
      status(code: number) {
        status = code;
        return res;
      },
      json(payload: unknown) {
        res.headersSent = true;
        finish(payload);
        return res;
      },
      send(payload: unknown) {
        res.headersSent = true;
        finish(payload);
        return res;
      },
      end() {
        res.headersSent = true;
        finish(undefined);
        return res;
      },
      setHeader() {
        return res;
      },
      set() {
        return res;
      },
      sendStatus(code: number) {
        status = code;
        finish(undefined);
        return res;
      },
    };

    const req: any = {
      user,
      body: input.body ?? {},
      params: input.params ?? {},
      query: input.query ?? {},
      headers: {},
      get: () => undefined,
    };

    Promise.resolve()
      .then(() => handler(req, res))
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}
