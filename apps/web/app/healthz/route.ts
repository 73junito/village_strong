export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      service: "village-strong",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
