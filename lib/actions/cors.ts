import { createActionHeaders } from "@solana/actions"

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"
const ACTION_HEADERS = createActionHeaders({ chainId: CLUSTER })

export function OPTIONS_RESPONSE(): Response {
  return new Response(null, {
    status: 204,
    headers: ACTION_HEADERS,
  })
}

export function actionJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...ACTION_HEADERS,
    },
  })
}

export function actionErrorResponse(message: string, status = 400): Response {
  return actionJsonResponse({ error: message }, status)
}
