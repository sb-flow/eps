import "server-only";
export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw Error("Cross-origin mutation denied");
}
