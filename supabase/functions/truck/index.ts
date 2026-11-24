import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "POST") {
    if (req.headers.get("x-api-key") !== Deno.env.get("INGEST_KEY")) {
      return json({ error: "unauthorized" }, 401);
    }
    const b = await req.json().catch(() => null);
    const comps = b?.compartments;
    if (!/^[a-z0-9_-]{1,40}$/.test(b?.device_id ?? "") ||
        !Array.isArray(comps) || comps.length < 1 || comps.length > 3 ||
        comps.some((c: any) => !/^c[1-9]$/.test(c?.id ?? "") ||
          !Number.isFinite(Number(c.level)) || c.level < 0 || c.level > 100)) {
      return json({ error: "invalid payload" }, 400);
    }
    const rows = await Promise.all(comps.map(async (c: any) => {
      const { data } = await db.from("truck_readings").select("value")
        .eq("device_id", b.device_id).eq("compartment", c.id)
        .order("received_at", { ascending: false }).limit(1);
      const prev = data?.[0]?.value;
      // vazamento = queda de 5 pontos percentuais ou mais entre duas leituras
      const alert = (prev != null && prev - c.level >= 5) ? "vazamento"
        : c.level < 20 ? "baixo" : c.level > 95 ? "transbordo" : "normal";
      return { device_id: b.device_id, compartment: c.id, value: c.level,
               distance_cm: Number.isFinite(Number(c.distance_cm)) ? c.distance_cm : null, alert };
    }));
    const { error } = await db.from("truck_readings").insert(rows);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, alerts: rows.map((r) => r.alert) }, 201);
  }

  if (req.method === "GET") {
    const device = new URL(req.url).searchParams.get("device_id") ?? "caminhao01";
    const { data, error } = await db.from("truck_readings")
      .select("compartment,value,unit,distance_cm,alert,received_at")
      .eq("device_id", device).order("received_at", { ascending: false }).limit(60);
    if (error) return json({ error: error.message }, 500);
    const latest: Record<string, unknown> = {};
    for (const r of data) if (!latest[r.compartment]) latest[r.compartment] = r;
    return json({ latest, history: data.slice(0, 18) });
  }
  return json({ error: "method not allowed" }, 405);
});
